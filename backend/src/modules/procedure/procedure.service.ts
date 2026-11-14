import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import { buildMeta, toSkipTake } from '../../core/common/utils/pagination.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OperatonService } from '../operaton/operaton.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { ListProceduresQueryDto } from './dto/list-procedures-query.dto';
import { UpdateProcedureVersionDto } from './dto/update-procedure-version.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ProcedureValidationService } from './procedure-validation.service';
import {
  UserDirectoryItem,
  ValidationResult,
} from './procedure.types';

@Injectable()
export class ProcedureService {
  private readonly logger = new Logger(ProcedureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operatonService: OperatonService,
    private readonly validationService: ProcedureValidationService,
  ) {}

  /**
   * 1. Create a new Procedure and initialize its Draft Version (v1).
   */
  async create(createdById: string, dto: CreateProcedureDto) {
    const existing = await this.prisma.procedure.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(`Mã thủ tục [${dto.code}] đã tồn tại trong hệ thống.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.procedure.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          description: dto.description ?? null,
          departmentId: dto.departmentId ?? null,
          icon: dto.icon || 'file-text',
          color: dto.color || '#2563eb',
          createdById,
        },
      });

      const draftVersion = await tx.procedureVersion.create({
        data: {
          procedureId: procedure.id,
          version: 1,
          status: 'DRAFT',
          createdById,
        },
      });

      return {
        ...procedure,
        draftVersion,
      };
    });
  }

  /**
   * 2. Paginated list of Procedures with search & filter.
   */
  async findAll(query: ListProceduresQueryDto, userRole?: string): Promise<Paginated<any>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.ProcedureWhereInput = {};

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    // Non-admin users only see published procedures (activeVersionId != null)
    const isAdmin = userRole === 'admin' || userRole === 'SUPER_ADMIN';
    if (!isAdmin) {
      where.activeVersionId = { not: null };
    } else if (query.status) {
      where.versions = {
        some: {
          status: query.status as any,
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          activeVersion: {
            include: {
              formVersion: {
                include: {
                  form: { select: { id: true, name: true } },
                },
              },
            },
          },
          versions: {
            select: {
              id: true,
              version: true,
              status: true,
              publishedAt: true,
              createdAt: true,
            },
            orderBy: { version: 'desc' },
          },
        },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return {
      items,
      meta: buildMeta(total, page, limit),
    };
  }

  /**
   * 3. Get single Procedure by ID with active version and version list.
   */
  async findById(id: string) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: {
        activeVersion: {
          include: {
            formVersion: {
              include: {
                form: { select: { id: true, name: true } },
                fields: true,
              },
            },
            actorMappings: {
              include: {
                defaultUser: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                    department: true,
                    title: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
            variableMappings: true,
          },
        },
        versions: {
          select: {
            id: true,
            version: true,
            status: true,
            publishedAt: true,
            createdAt: true,
          },
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!procedure) {
      throw new NotFoundException(`Thủ tục không tồn tại (ID: ${id})`);
    }

    return procedure;
  }

  /**
   * 4. Update Procedure general information.
   */
  async update(id: string, dto: UpdateProcedureDto) {
    await this.findById(id);

    const data: Prisma.ProcedureUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.departmentId !== undefined) data.departmentId = dto.departmentId;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.color !== undefined) data.color = dto.color;

    return this.prisma.procedure.update({
      where: { id },
      data,
    });
  }

  /**
   * 5. Delete a Procedure and all its versions.
   */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.procedure.delete({
      where: { id },
    });
  }

  /**
   * 6. List all versions for a procedure.
   */
  async getVersions(procedureId: string) {
    await this.findById(procedureId);
    return this.prisma.procedureVersion.findMany({
      where: { procedureId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        procedureId: true,
        version: true,
        status: true,
        formVersionId: true,
        operatonDefinitionKey: true,
        operatonDefinitionVersion: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * 7. Get full details of a specific ProcedureVersion.
   */
  async getVersionById(versionId: string) {
    const version = await this.prisma.procedureVersion.findUnique({
      where: { id: versionId },
      include: {
        procedure: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            departmentId: true,
            icon: true,
            color: true,
            activeVersionId: true,
          },
        },
        formVersion: {
          include: {
            form: { select: { id: true, name: true } },
            fields: {
              orderBy: { key: 'asc' },
            },
          },
        },
        actorMappings: {
          include: {
            defaultUser: {
              select: {
                id: true,
                displayName: true,
                email: true,
                department: true,
                title: true,
                role: true,
                isActive: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
        variableMappings: {
          orderBy: { operatonVarName: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException(`Phiên bản thủ tục không tồn tại (ID: ${versionId})`);
    }

    // If operatonDefinitionId is set, enrich with workflow details from Operaton
    let workflow: any = null;
    if (version.operatonDefinitionId) {
      try {
        const structure = await this.operatonService.getDefinitionStructure(
          version.operatonDefinitionId,
        );
        workflow = {
          definitionId: version.operatonDefinitionId,
          definitionKey: version.operatonDefinitionKey,
          version: version.operatonDefinitionVersion,
          category: structure.category,
          conditionVariables: structure.conditionVariables,
          tasks: (structure.tasks || []).map((t) => ({
            ...t,
            id: t.taskKey,
          })),
        };
      } catch (err: any) {
        this.logger.warn(
          `Could not enrich workflow info for ${version.operatonDefinitionId}: ${err.message}`,
        );
      }
    }

    return {
      ...version,
      workflow,
    };
  }

  /**
   * 8. Create a new Draft Version (cloning from latest/published version).
   */
  async createDraftVersion(procedureId: string, createdById: string) {
    const procedure = await this.findById(procedureId);

    // If an existing DRAFT version is already present, return it
    const existingDraft = await this.prisma.procedureVersion.findFirst({
      where: { procedureId, status: 'DRAFT' },
    });
    if (existingDraft) {
      return this.getVersionById(existingDraft.id);
    }

    // Determine highest version number
    const maxVersionAgg = await this.prisma.procedureVersion.aggregate({
      where: { procedureId },
      _max: { version: true },
    });
    const nextVersion = (maxVersionAgg._max.version || 0) + 1;

    // Find base version to copy mappings from (active version or latest version)
    const baseVersion =
      procedure.activeVersion ||
      (await this.prisma.procedureVersion.findFirst({
        where: { procedureId },
        orderBy: { version: 'desc' },
        include: {
          actorMappings: true,
          variableMappings: true,
        },
      }));

    return this.prisma.$transaction(async (tx) => {
      const newVersion = await tx.procedureVersion.create({
        data: {
          procedureId,
          version: nextVersion,
          status: 'DRAFT',
          formVersionId: baseVersion?.formVersionId ?? null,
          operatonDefinitionId: baseVersion?.operatonDefinitionId ?? null,
          operatonDefinitionKey: baseVersion?.operatonDefinitionKey ?? null,
          operatonDefinitionVersion: baseVersion?.operatonDefinitionVersion ?? null,
          operatonDeploymentId: baseVersion?.operatonDeploymentId ?? null,
          createdById,
        },
      });

      // Clone actor mappings if available
      if (baseVersion?.actorMappings && baseVersion.actorMappings.length > 0) {
        await tx.procedureActorMapping.createMany({
          data: baseVersion.actorMappings.map((am) => ({
            procedureVersionId: newVersion.id,
            taskDefinitionKey: am.taskDefinitionKey,
            taskName: am.taskName,
            order: am.order,
            assigneeType: am.assigneeType,
            defaultUserId: am.defaultUserId,
            ruleConfig: am.ruleConfig as any,
            allowOverride: am.allowOverride,
            required: am.required,
            isMultiInstance: am.isMultiInstance,
            collectionVariable: am.collectionVariable,
          })),
        });
      }

      // Clone variable mappings if available
      if (baseVersion?.variableMappings && baseVersion.variableMappings.length > 0) {
        await tx.procedureVariableMapping.createMany({
          data: baseVersion.variableMappings.map((vm) => ({
            procedureVersionId: newVersion.id,
            operatonVarName: vm.operatonVarName,
            formFieldKey: vm.formFieldKey,
            variableType: vm.variableType,
            fallbackValue: vm.fallbackValue,
          })),
        });
      }

      return newVersion;
    });
  }

  /**
   * 9. Update Draft Version configuration (Form, Workflow, Actors, Variables).
   */
  async updateDraftVersion(versionId: string, dto: UpdateProcedureVersionDto) {
    const version = await this.prisma.procedureVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException(`Phiên bản thủ tục không tồn tại (ID: ${versionId})`);
    }

    if (version.status !== 'DRAFT') {
      throw new ForbiddenException(
        'Không thể chỉnh sửa phiên bản đã xuất bản (PUBLISHED) hoặc đã lưu trữ (ARCHIVED). Vui lòng tạo phiên bản mới.',
      );
    }

    // If operatonDefinitionId is provided, extract its key and version
    let opKey = version.operatonDefinitionKey;
    let opVer = version.operatonDefinitionVersion;
    let opDep = version.operatonDeploymentId;

    if (dto.operatonDefinitionId && dto.operatonDefinitionId !== version.operatonDefinitionId) {
      try {
        const defs = await this.operatonService.getDefinitions(undefined, false);
        const match = defs.find((d) => d.id === dto.operatonDefinitionId);
        if (match) {
          opKey = match.key;
          opVer = match.version;
          opDep = match.deploymentId;
        }
      } catch (err: any) {
        this.logger.warn(`Could not resolve operaton definition meta: ${err.message}`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update ProcedureVersion core fields
      await tx.procedureVersion.update({
        where: { id: versionId },
        data: {
          formVersionId: dto.formVersionId !== undefined ? dto.formVersionId : version.formVersionId,
          operatonDefinitionId:
            dto.operatonDefinitionId !== undefined
              ? dto.operatonDefinitionId
              : version.operatonDefinitionId,
          operatonDefinitionKey: opKey,
          operatonDefinitionVersion: opVer,
          operatonDeploymentId: opDep,
        },
      });

      // 2. Replace actor mappings
      if (dto.actorMappings) {
        await tx.procedureActorMapping.deleteMany({
          where: { procedureVersionId: versionId },
        });

        if (dto.actorMappings.length > 0) {
          await tx.procedureActorMapping.createMany({
            data: dto.actorMappings.map((am) => ({
              procedureVersionId: versionId,
              taskDefinitionKey: am.taskDefinitionKey,
              taskName: am.taskName,
              order: am.order,
              assigneeType: am.assigneeType,
              defaultUserId: am.defaultUserId || null,
              ruleConfig: am.ruleConfig ?? undefined,
              allowOverride: am.allowOverride !== undefined ? am.allowOverride : true,
              required: am.required !== undefined ? am.required : true,
              isMultiInstance: am.isMultiInstance || false,
              collectionVariable: am.collectionVariable || null,
            })),
          });
        }
      }

      // 3. Replace variable mappings
      if (dto.variableMappings) {
        await tx.procedureVariableMapping.deleteMany({
          where: { procedureVersionId: versionId },
        });

        if (dto.variableMappings.length > 0) {
          await tx.procedureVariableMapping.createMany({
            data: dto.variableMappings.map((vm) => ({
              procedureVersionId: versionId,
              operatonVarName: vm.operatonVarName,
              formFieldKey: vm.formFieldKey,
              variableType: vm.variableType,
              fallbackValue: vm.fallbackValue || null,
            })),
          });
        }
      }
    });

    return this.getVersionById(versionId);
  }

  /**
   * 10. Validate version against the pre-publish rules.
   */
  async validateVersion(versionId: string): Promise<ValidationResult> {
    return this.validationService.validate(versionId);
  }

  /**
   * 11. Publish Version (Immutability & Pinning).
   */
  async publishVersion(versionId: string, _userId?: string) {
    const version = await this.prisma.procedureVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException(`Phiên bản thủ tục không tồn tại (ID: ${versionId})`);
    }

    if (version.status !== 'DRAFT') {
      throw new BadRequestException('Chỉ có thể xuất bản phiên bản đang ở trạng thái DRAFT.');
    }

    // 1. Run full validation
    const validation = await this.validationService.validate(versionId);
    if (!validation.isValid) {
      throw new UnprocessableEntityException({
        message: 'Thẩm định cấu hình thủ tục không đạt. Vui lòng khắc phục các lỗi trước khi xuất bản.',
        errors: validation.errors,
        warnings: validation.warnings,
        details: validation.errors,
      });
    }

    // 2. Fetch BPMN XML snapshot for offline preview & immutability
    let bpmnXmlSnapshot: string | null = null;
    if (version.operatonDefinitionId) {
      try {
        bpmnXmlSnapshot = await this.operatonService.getDefinitionXml(
          version.operatonDefinitionId,
        );
      } catch (err: any) {
        this.logger.warn(`Could not snapshot BPMN XML: ${err.message}`);
      }
    }

    // 3. Publish in transaction: Archive older published versions and set activeVersionId
    return this.prisma.$transaction(async (tx) => {
      // Archive previous published versions of this procedure
      await tx.procedureVersion.updateMany({
        where: {
          procedureId: version.procedureId,
          status: 'PUBLISHED',
        },
        data: {
          status: 'ARCHIVED',
        },
      });

      // Update current version to PUBLISHED
      const published = await tx.procedureVersion.update({
        where: { id: versionId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          bpmnSnapshotXml: bpmnXmlSnapshot,
        },
      });

      // Update procedure activeVersionId
      await tx.procedure.update({
        where: { id: version.procedureId },
        data: {
          activeVersionId: versionId,
        },
      });

      return {
        success: true,
        message: `Đã xuất bản thành công phiên bản ${published.version} của thủ tục.`,
        procedureVersion: published,
      };
    });
  }

  /**
   * 12. Helper: User directory with department & title for Actor Autocomplete Picker.
   */
  async getDirectory(search?: string, departmentId?: string): Promise<UserDirectoryItem[]> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.organizationMembers = {
        some: {
          organizationId: departmentId,
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        email: true,
        department: true,
        title: true,
        role: true,
        isActive: true,
        signatureImage: true,
        organizationMembers: {
          include: {
            organization: {
              select: { id: true, name: true, type: true },
            },
          },
        },
      },
      take: 50,
      orderBy: { displayName: 'asc' },
    });

    return users.map((u) => {
      // Fallback department from organization members if direct field is empty
      const orgDept = u.organizationMembers[0]?.organization?.name || null;
      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        department: u.department || orgDept,
        title: u.title,
        role: u.role,
        isActive: u.isActive,
        signatureImage: u.signatureImage,
      };
    });
  }

  /**
   * 13. Helper: Available Forms & Versions.
   */
  async getHelperForms() {
    return this.prisma.form.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            fields: {
              orderBy: { key: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 14. Helper: Available Operaton Workflows (category='e-Office').
   */
  async getHelperWorkflows() {
    return this.operatonService.getDefinitions('e-Office', true);
  }

  /**
   * 15. Helper: Available Organizations & Job Titles for Dynamic Actor rules.
   */
  async getOrgTitles(): Promise<{
    departments: Array<{ id: string; name: string }>;
    titles: string[];
  }> {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const userTitles = await this.prisma.user.findMany({
      where: { title: { not: null }, isActive: true },
      select: { title: true },
      distinct: ['title'],
      orderBy: { title: 'asc' },
    });

    const titles = userTitles.map((u) => u.title!).filter(Boolean);

    return {
      departments: orgs,
      titles,
    };
  }
}
