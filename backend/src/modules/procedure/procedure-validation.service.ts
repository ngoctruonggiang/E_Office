import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OperatonService } from '../operaton/operaton.service';
import {
  ValidationErrorItem,
  ValidationResult,
  ValidationWarningItem,
} from './procedure.types';

@Injectable()
export class ProcedureValidationService {
  private readonly logger = new Logger(ProcedureValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly operatonService: OperatonService,
  ) {}

  /**
   * Run the full pre-publish validation rules suite (VAL-PRC-01 to VAL-PRC-09)
   * on a given ProcedureVersion.
   */
  async validate(procedureVersionId: string): Promise<ValidationResult> {
    const errors: ValidationErrorItem[] = [];
    const warnings: ValidationWarningItem[] = [];

    // 1. Fetch ProcedureVersion with relations
    const version = await this.prisma.procedureVersion.findUnique({
      where: { id: procedureVersionId },
      include: {
        formVersion: {
          include: {
            fields: true,
          },
        },
        actorMappings: true,
        variableMappings: true,
      },
    });

    if (!version) {
      return {
        isValid: false,
        errors: [
          {
            code: 'VAL-PRC-00',
            field: 'id',
            message: `Phiên bản thủ tục không tồn tại (ID: ${procedureVersionId})`,
          },
        ],
        warnings: [],
      };
    }

    // ── VAL-PRC-01: FormVersion check ──────────────────────────────
    if (!version.formVersion || !version.formVersionId) {
      errors.push({
        code: 'VAL-PRC-01',
        field: 'formVersionId',
        message: 'Chưa chọn Biểu mẫu (Form Version) cho thủ tục.',
      });
    } else if (
      !version.formVersion.fields ||
      version.formVersion.fields.length === 0
    ) {
      errors.push({
        code: 'VAL-PRC-01',
        field: 'formVersionId',
        message: 'Biểu mẫu được chọn không có trường dữ liệu nào.',
      });
    }

    // ── VAL-PRC-02: Workflow check ─────────────────────────────────
    let workflowStructure: any = null;
    if (!version.operatonDefinitionId) {
      errors.push({
        code: 'VAL-PRC-02',
        field: 'operatonDefinitionId',
        message: 'Chưa chọn Quy trình Operaton (BPMN Workflow) cho thủ tục.',
      });
    } else {
      try {
        workflowStructure = await this.operatonService.getDefinitionStructure(
          version.operatonDefinitionId,
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to get workflow structure for ${version.operatonDefinitionId}: ${err.message}`,
        );
        errors.push({
          code: 'VAL-PRC-02',
          field: 'operatonDefinitionId',
          message: `Không thể kết nối hoặc phân tích quy trình trên Operaton Engine: ${err.message}`,
        });
      }
    }

    // If either Form or Workflow is missing/invalid, return early
    if (!version.formVersion || !workflowStructure) {
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    }

    const formFields = version.formVersion.fields;
    const formFieldMap = new Map(formFields.map((f) => [f.key, f]));

    // ── VAL-PRC-03: Variable Coverage ──────────────────────────────
    const conditionVars: string[] = workflowStructure.conditionVariables || [];
    const varMappings = version.variableMappings || [];
    const mappedVarNames = new Set(varMappings.map((v) => v.operatonVarName));

    for (const cVar of conditionVars) {
      if (!mappedVarNames.has(cVar)) {
        errors.push({
          code: 'VAL-PRC-03',
          field: `variableMappings.${cVar}`,
          message: `Thiếu ánh xạ cho biến điều kiện rẽ nhánh: [${cVar}]. Vui lòng chọn trường form tương ứng.`,
        });
      }
    }

    // ── VAL-PRC-04 & VAL-PRC-05: Target Field Validity & Type Check ─
    for (const vm of varMappings) {
      const field = formFieldMap.get(vm.formFieldKey);
      if (!field) {
        errors.push({
          code: 'VAL-PRC-04',
          field: `variableMappings.${vm.operatonVarName}`,
          message: `Trường form [${vm.formFieldKey}] không tồn tại trong phiên bản Form đã chọn.`,
        });
      } else {
        // VAL-PRC-05: Type compatibility check (Warning only)
        if (vm.variableType === 'NUMBER' && field.type === 'TEXT') {
          warnings.push({
            code: 'VAL-PRC-05',
            field: `variableMappings.${vm.operatonVarName}`,
            message: `Trường [${field.label || field.key}] có kiểu TEXT nhưng được ánh xạ vào biến số học [${vm.operatonVarName}].`,
          });
        }
      }
    }

    // ── VAL-PRC-06: Actor Coverage ─────────────────────────────────
    const workflowTasks = workflowStructure.tasks || [];
    const actorMappings = version.actorMappings || [];
    const mappedTaskKeys = new Set(actorMappings.map((a) => a.taskDefinitionKey));

    for (const task of workflowTasks) {
      const taskKey = task.taskKey || task.id;
      if (!mappedTaskKeys.has(taskKey)) {
        errors.push({
          code: 'VAL-PRC-06',
          field: `actorMappings.${taskKey}`,
          message: `Chưa cấu hình người duyệt cho bước: [${task.name || taskKey}].`,
        });
      }
    }

    // ── VAL-PRC-07, VAL-PRC-08 & VAL-PRC-09: Actor Details Check ───
    for (const am of actorMappings) {
      // VAL-PRC-07: Non-overridable step must have defaultUserId (if DIRECT_USER) or ruleConfig (if DYNAMIC_RULE)
      const hasDirectUser = am.assigneeType === 'DIRECT_USER' && !!am.defaultUserId;
      const hasDynamicRule = am.assigneeType === 'DYNAMIC_RULE' && !!am.ruleConfig;
      if (!am.allowOverride && am.required && !hasDirectUser && !hasDynamicRule) {
        errors.push({
          code: 'VAL-PRC-07',
          field: `actorMappings.${am.taskDefinitionKey}`,
          message: `Bước [${am.taskName || am.taskDefinitionKey}] bị khóa cố định (không cho sửa) nhưng chưa được gán người duyệt mặc định hoặc quy tắc động.`,
        });
      }

      if (am.assigneeType === 'DYNAMIC_RULE' && !am.ruleConfig) {
        errors.push({
          code: 'VAL-PRC-07',
          field: `actorMappings.${am.taskDefinitionKey}`,
          message: `Bước [${am.taskName || am.taskDefinitionKey}] được chọn là Quy tắc động nhưng chưa có cấu hình quy tắc.`,
        });
      }

      // VAL-PRC-08: Default user must exist and be active
      if (am.defaultUserId) {
        const user = await this.prisma.user.findUnique({
          where: { id: am.defaultUserId },
          select: { id: true, email: true, displayName: true, isActive: true },
        });

        if (!user) {
          errors.push({
            code: 'VAL-PRC-08',
            field: `actorMappings.${am.taskDefinitionKey}`,
            message: `Người duyệt được chỉ định cho bước [${am.taskName || am.taskDefinitionKey}] không tồn tại trong hệ thống.`,
          });
        } else if (!user.isActive) {
          errors.push({
            code: 'VAL-PRC-08',
            field: `actorMappings.${am.taskDefinitionKey}`,
            message: `Người duyệt [${user.displayName || user.email}] cho bước [${am.taskName || am.taskDefinitionKey}] đang bị vô hiệu hóa tài khoản.`,
          });
        }
      }

      // VAL-PRC-09: Multi-instance collection check
      if (am.isMultiInstance && !am.collectionVariable) {
        errors.push({
          code: 'VAL-PRC-09',
          field: `actorMappings.${am.taskDefinitionKey}`,
          message: `Bước hội đồng/song song [${am.taskName || am.taskDefinitionKey}] thiếu tên biến danh sách (collectionVariable).`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
