import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import { buildMeta, toSkipTake } from '../../core/common/utils/pagination.util';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { AddOptionDto } from './dto/add-option.dto';
import { FormFieldInput } from './dto/form-field.input';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import {
  FieldOptionView,
  FieldValidationView,
  FormDetailDto,
  FormFieldView,
  FormSummaryDto,
} from './dto/form-detail.dto';
import { LayoutSchemaV1, TableFieldConfig } from './layout-schema.types';
import { validateFormStructure } from './validators/layout.validator';

const VERSION_INCLUDE = {
  fields: { include: { options: true, validations: true } },
} as const;

type LoadedVersion = Prisma.FormVersionGetPayload<{
  include: typeof VERSION_INCLUDE;
}>;

@Injectable()
export class FormBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List form categories — used by the frontend to pick which form to fill
   * in. Optionally filtered by name, paginated.
   */
  async listForms(
    query: ListFormsQueryDto,
  ): Promise<Paginated<FormSummaryDto>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.FormWhereInput = query.name
      ? { name: { contains: query.name, mode: 'insensitive' } }
      : {};

    const [forms, total] = await Promise.all([
      this.prisma.form.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            select: {
              version: true,
              _count: { select: { responses: true } },
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.form.count({ where }),
    ]);

    return {
      items: forms.map((f) => ({
        id: f.id,
        name: f.name,
        latestVersion: f.versions[0]?.version ?? 0,
        requestCount: f.versions.reduce(
          (sum, v) => sum + v._count.responses,
          0,
        ),
        createdAt: f.createdAt,
      })),
      meta: buildMeta(total, page, limit),
    };
  }

  /** Create a form (category) with its first version + fields + optional layout. */
  async createForm(userId: string, dto: CreateFormDto): Promise<FormDetailDto> {
    validateFormStructure(dto.fields, dto.layoutSchema);

    const formId = await this.prisma.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: {
          name: dto.name,
          createdById: userId,
        },
      });
      const version = await tx.formVersion.create({
        data: {
          formId: form.id,
          version: 1,
          ...this.nullableJsonColumn('layoutSchema', dto.layoutSchema),
        },
      });
      await this.createFields(tx, version.id, dto.fields);
      return form.id;
    });

    return this.getForm(formId);
  }

  /**
   * Update a form following ADR-005 & Phase 2 data-model versioning policy:
   * - Name-only update keeps the current version.
   * - Adding/removing keys, changing field type, changing TABLE columns, or
   *   any field/layout edit when responses > 0 forks a NEW FormVersion.
   * - Otherwise (0 responses, existing keys & matching types) patches in place.
   */
  async updateForm(formId: string, dto: UpdateFormDto): Promise<FormDetailDto> {
    const current = await this.prisma.formVersion.findFirst({
      where: { formId },
      orderBy: { version: 'desc' },
      include: {
        ...VERSION_INCLUDE,
        _count: { select: { responses: true } },
      },
    });
    if (!current) {
      throw new NotFoundException('Form not found');
    }

    const hasFieldsPatch = Boolean(dto.fields && dto.fields.length > 0);
    const hasLayoutPatch = dto.layoutSchema !== undefined;
    const hasResponses = current._count.responses > 0;

    if (hasFieldsPatch || hasLayoutPatch) {
      const existingByKey = new Map(current.fields.map((f) => [f.key, f]));
      const incomingFields = dto.fields ?? [];
      const incomingKeys = new Set(incomingFields.map((f) => f.key));

      const hasStructuralFieldChange =
        hasFieldsPatch &&
        (incomingFields.some((f) => {
          const prev = existingByKey.get(f.key);
          if (!prev || prev.type !== f.type) return true;
          if (f.type === FieldType.TABLE && f.tableConfig !== undefined) {
            return !this.tableColumnsEqual(prev.tableConfig, f.tableConfig);
          }
          return false;
        }) ||
          ((hasLayoutPatch || hasResponses) &&
            current.fields.some((prev) => !incomingKeys.has(prev.key))));

      const needsNewVersion =
        hasStructuralFieldChange ||
        (hasResponses && (hasFieldsPatch || hasLayoutPatch));

      const fieldsForValidation = hasFieldsPatch
        ? needsNewVersion
          ? incomingFields
          : this.mergePatchFields(current.fields, incomingFields)
        : this.toFieldInputs(current.fields);

      const layoutForValidation = hasLayoutPatch
        ? dto.layoutSchema
        : needsNewVersion && hasFieldsPatch
          ? this.pruneLayoutToKeys(
              current.layoutSchema as LayoutSchemaV1 | null,
              incomingKeys,
            )
          : current.layoutSchema;

      validateFormStructure(fieldsForValidation, layoutForValidation);

      await this.prisma.$transaction(async (tx) => {
        if (dto.name !== undefined) {
          await tx.form.update({
            where: { id: formId },
            data: { name: dto.name },
          });
        }

        if (needsNewVersion) {
          const fieldsToCreate = hasFieldsPatch
            ? incomingFields
            : this.toFieldInputs(current.fields);
          const version = await tx.formVersion.create({
            data: {
              formId,
              version: current.version + 1,
              ...this.nullableJsonColumn('layoutSchema', layoutForValidation),
            },
          });
          await this.createFields(tx, version.id, fieldsToCreate);
        } else {
          if (hasLayoutPatch) {
            await tx.formVersion.update({
              where: { id: current.id },
              data: this.nullableJsonColumn('layoutSchema', dto.layoutSchema),
            });
          }
          for (const f of incomingFields) {
            const existing = existingByKey.get(f.key)!;
            await tx.formField.update({
              where: {
                formVersionId_key: { formVersionId: current.id, key: f.key },
              },
              data: {
                label: f.label,
                required: f.required ?? false,
                maxLength: f.maxLength ?? null,
                placeholder: f.placeholder ?? null,
                min: f.min ?? null,
                max: f.max ?? null,
                selectMode: f.selectMode ?? null,
                ...this.jsonField('defaultValue', f.defaultValue),
                ...(f.type === FieldType.TABLE
                  ? this.nullableJsonColumn('tableConfig', f.tableConfig)
                  : { tableConfig: Prisma.DbNull }),
              },
            });

            if (f.options !== undefined) {
              await tx.fieldOption.deleteMany({ where: { fieldId: existing.id } });
              if (f.options.length > 0) {
                await tx.fieldOption.createMany({
                  data: f.options.map((o) => ({
                    fieldId: existing.id,
                    label: o.label,
                    value: o.value,
                  })),
                });
              }
            }

            if (f.validations !== undefined) {
              await tx.fieldValidation.deleteMany({
                where: { fieldId: existing.id },
              });
              if (f.validations.length > 0) {
                await tx.fieldValidation.createMany({
                  data: f.validations.map((v) => ({
                    fieldId: existing.id,
                    type: v.type,
                    regex: v.regex ?? null,
                  })),
                });
              }
            }
          }
        }
      });

      return this.getForm(formId);
    }

    // Name-only update
    if (dto.name !== undefined) {
      await this.prisma.form.update({
        where: { id: formId },
        data: { name: dto.name },
      });
    }

    return this.getForm(formId);
  }

  /** add_item: append an option to an existing SELECT field. */
  async addOption(
    formId: string,
    fieldId: string,
    dto: AddOptionDto,
  ): Promise<FormDetailDto> {
    const field = await this.prisma.formField.findUnique({
      where: { id: fieldId },
      include: { formVersion: true },
    });
    if (!field || field.formVersion.formId !== formId) {
      throw new NotFoundException('Field not found on this form');
    }
    if (field.type !== FieldType.SELECT) {
      throw new BadRequestException(
        'Options can only be added to SELECT fields',
      );
    }

    await this.prisma.fieldOption.create({
      data: { fieldId, label: dto.label, value: dto.value },
    });
    return this.getForm(formId);
  }

  /** Assembled latest version, render-ready for the frontend. */
  async getForm(formId: string): Promise<FormDetailDto> {
    const form = await this.prisma.form.findUnique({
      where: { id: formId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
          include: VERSION_INCLUDE,
        },
      },
    });

    if (!form) {
      throw new NotFoundException('Form not found');
    }
    const version = form.versions[0];
    if (!version) {
      throw new NotFoundException('Form has no versions');
    }

    return this.serializeVersion(form.id, form.name, version);
  }

  /** Assembled specific FormVersion by its id (pinned rendering, ADR-005). */
  async getFormVersion(versionId: string): Promise<FormDetailDto> {
    const version = await this.prisma.formVersion.findUnique({
      where: { id: versionId },
      include: {
        form: { select: { id: true, name: true } },
        ...VERSION_INCLUDE,
      },
    });

    if (!version) {
      throw new NotFoundException('Form version not found');
    }

    return this.serializeVersion(version.form.id, version.form.name, version);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private serializeVersion(
    formId: string,
    formName: string,
    version: LoadedVersion,
  ): FormDetailDto {
    return {
      id: formId,
      name: formName,
      version: version.version,
      versionId: version.id,
      layoutSchema: version.layoutSchema ?? null,
      fields: version.fields.map(
        (f): FormFieldView => ({
          id: f.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          defaultValue: f.defaultValue,
          maxLength: f.maxLength,
          placeholder: f.placeholder,
          min: f.min,
          max: f.max,
          selectMode: f.selectMode,
          tableConfig: f.type === FieldType.TABLE ? (f.tableConfig ?? null) : null,
          options: f.options.map(
            (o): FieldOptionView => ({
              id: o.id,
              label: o.label,
              value: o.value,
            }),
          ),
          validations: f.validations.map(
            (v): FieldValidationView => ({ type: v.type, regex: v.regex }),
          ),
        }),
      ),
    };
  }

  private async createFields(
    tx: Prisma.TransactionClient,
    formVersionId: string,
    fields: FormFieldInput[],
  ): Promise<void> {
    for (const f of fields) {
      const field = await tx.formField.create({
        data: {
          formVersionId,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          maxLength: f.maxLength ?? null,
          placeholder: f.placeholder ?? null,
          min: f.min ?? null,
          max: f.max ?? null,
          selectMode: f.selectMode ?? null,
          ...this.jsonField('defaultValue', f.defaultValue),
          ...(f.type === FieldType.TABLE
            ? this.nullableJsonColumn('tableConfig', f.tableConfig)
            : {}),
        },
      });

      if (f.options?.length) {
        await tx.fieldOption.createMany({
          data: f.options.map((o) => ({
            fieldId: field.id,
            label: o.label,
            value: o.value,
          })),
        });
      }
      if (f.validations?.length) {
        await tx.fieldValidation.createMany({
          data: f.validations.map((v) => ({
            fieldId: field.id,
            type: v.type,
            regex: v.regex ?? null,
          })),
        });
      }
    }
  }

  private toFieldInputs(fields: LoadedVersion['fields']): FormFieldInput[] {
    return fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      defaultValue: f.defaultValue ?? undefined,
      maxLength: f.maxLength ?? undefined,
      placeholder: f.placeholder ?? undefined,
      min: f.min ?? undefined,
      max: f.max ?? undefined,
      selectMode: f.selectMode ?? undefined,
      tableConfig: f.type === FieldType.TABLE ? (f.tableConfig ?? undefined) : undefined,
      options: f.options.map((o) => ({ label: o.label, value: o.value })),
      validations: f.validations.map((v) => ({
        type: v.type,
        regex: v.regex ?? undefined,
      })),
    }));
  }

  private mergePatchFields(
    currentFields: LoadedVersion['fields'],
    incomingFields: FormFieldInput[],
  ): FormFieldInput[] {
    const incomingMap = new Map(incomingFields.map((f) => [f.key, f]));
    return currentFields.map((prev) => {
      const patched = incomingMap.get(prev.key);
      if (!patched) return this.toFieldInputs([prev])[0];
      return {
        ...this.toFieldInputs([prev])[0],
        ...patched,
        options:
          patched.options ??
          prev.options.map((o) => ({ label: o.label, value: o.value })),
        validations:
          patched.validations ??
          prev.validations.map((v) => ({
            type: v.type,
            regex: v.regex ?? undefined,
          })),
      };
    });
  }

  private tableColumnsEqual(prevRaw: unknown, nextRaw: unknown): boolean {
    const prevCols = (prevRaw as TableFieldConfig | null)?.columns ?? [];
    const nextCols = (nextRaw as TableFieldConfig | null)?.columns ?? [];
    return JSON.stringify(prevCols) === JSON.stringify(nextCols);
  }

  private pruneLayoutToKeys(
    layout: LayoutSchemaV1 | null | undefined,
    allowedKeys: Set<string>,
  ): LayoutSchemaV1 | null {
    if (!layout) return null;
    const sections = layout.sections
      .map((sec) => ({
        ...sec,
        rows: sec.rows
          .map((row) => ({
            ...row,
            items: row.items.filter(
              (item) => item.kind !== 'field' || allowedKeys.has(item.fieldKey),
            ),
          }))
          .filter((row) => row.items.length > 0),
      }))
      .filter((sec) => sec.rows.length > 0);

    return sections.length > 0 ? { ...layout, sections } : null;
  }

  /** Build a Json column patch, mapping `undefined` to "leave unset". */
  private jsonField(
    name: 'defaultValue',
    value: unknown,
  ): Record<string, Prisma.InputJsonValue> | object {
    if (value === undefined) return {};
    return { [name]: value as Prisma.InputJsonValue };
  }

  private nullableJsonColumn(
    name: 'layoutSchema' | 'tableConfig',
    value: unknown,
  ): Record<string, Prisma.InputJsonValue | typeof Prisma.DbNull> {
    if (value === undefined || value === null) {
      return { [name]: Prisma.DbNull };
    }
    return { [name]: value as Prisma.InputJsonValue };
  }
}
