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

  /** Create a form (category) with its first version + fields. */
  async createForm(userId: string, dto: CreateFormDto): Promise<FormDetailDto> {
    const formId = await this.prisma.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: {
          name: dto.name,
          createdById: userId,
        },
      });
      const version = await tx.formVersion.create({
        data: { formId: form.id, version: 1 },
      });
      await this.createFields(tx, version.id, dto.fields);
      return form.id;
    });

    return this.getForm(formId);
  }

  /**
   * Update a form. Changing a field's `type` or adding a new field `key`
   * produces a NEW version (old requests keep pointing at their version).
   * Otherwise the current version's fields are updated in place.
   */
  async updateForm(formId: string, dto: UpdateFormDto): Promise<FormDetailDto> {
    const current = await this.getLatestVersionOrThrow(formId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.form.update({
          where: { id: formId },
          data: { name: dto.name },
        });
      }

      if (dto.fields && dto.fields.length > 0) {
        const existingByKey = new Map(current.fields.map((f) => [f.key, f]));
        const needsNewVersion = dto.fields.some((f) => {
          const prev = existingByKey.get(f.key);
          return !prev || prev.type !== f.type; // new field or type change
        });

        if (needsNewVersion) {
          const version = await tx.formVersion.create({
            data: { formId, version: current.version + 1 },
          });
          await this.createFields(tx, version.id, dto.fields);
        } else {
          // In-place scalar updates only (options/validations via add_item).
          for (const f of dto.fields) {
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
              },
            });
          }
        }
      }
    });

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
          include: {
            fields: { include: { options: true, validations: true } },
          },
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

    return {
      id: form.id,
      name: form.name,
      version: version.version,
      versionId: version.id,
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

  // ── helpers ────────────────────────────────────────────────────────────

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

  private async getLatestVersionOrThrow(formId: string) {
    const version = await this.prisma.formVersion.findFirst({
      where: { formId },
      orderBy: { version: 'desc' },
      include: { fields: true },
    });
    if (!version) {
      throw new NotFoundException('Form not found');
    }
    return version;
  }

  /** Build a Json column patch, mapping `undefined` to "leave unset". */
  private jsonField(
    name: 'defaultValue',
    value: unknown,
  ): Record<string, Prisma.InputJsonValue> | object {
    if (value === undefined) return {};
    return { [name]: value as Prisma.InputJsonValue };
  }
}
