import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UserEntity } from '../user/entities/user.entity';

export type DynamicActorRuleType =
  | 'DIRECT_MANAGER'
  | 'DEPARTMENT_TITLE'
  | 'REQUESTOR_DEPT_TITLE';

export type DynamicActorFallbackStrategy =
  | 'PARENT_MANAGER'
  | 'SPECIFIC_USER'
  | 'BLOCK_SUBMISSION';

export interface DynamicActorRuleConfig {
  ruleType: DynamicActorRuleType;
  departmentName?: string | null;
  departmentId?: string | null;
  targetJobTitle?: string | null;
  fallbackStrategy: DynamicActorFallbackStrategy;
  fallbackUserId?: string | null;
  fallbackUserName?: string | null;
}

export interface ResolvedActorResult {
  taskDefinitionKey: string;
  taskName: string;
  order: number;
  assigneeType: 'DIRECT_USER' | 'DYNAMIC_RULE';
  ruleType?: DynamicActorRuleType;
  user: UserEntity | null;
  isFallback: boolean;
  resolutionOrigin?: string;
  allowOverride: boolean;
  required: boolean;
  isMultiInstance: boolean;
  collectionVariable?: string | null;
}

@Injectable()
export class ActorResolverService {
  private readonly logger = new Logger(ActorResolverService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phân giải một actor mapping thành UserEntity thực tế dựa theo requestorId.
   */
  async resolveActor(
    mapping: {
      taskDefinitionKey: string;
      taskName: string;
      order: number;
      assigneeType: string;
      defaultUserId?: string | null;
      ruleConfig?: any;
      allowOverride: boolean;
      required: boolean;
      isMultiInstance: boolean;
      collectionVariable?: string | null;
      defaultUser?: any;
    },
    requestorId: string,
  ): Promise<ResolvedActorResult> {
    // 1. Trường hợp DIRECT_USER: Gán đích danh
    if (mapping.assigneeType === 'DIRECT_USER' || !mapping.ruleConfig) {
      let user: UserEntity | null = null;
      if (mapping.defaultUserId) {
        user = await this.prisma.user.findUnique({
          where: { id: mapping.defaultUserId },
        });
      } else if (mapping.defaultUser) {
        user = mapping.defaultUser;
      }
      return {
        taskDefinitionKey: mapping.taskDefinitionKey,
        taskName: mapping.taskName,
        order: mapping.order,
        assigneeType: 'DIRECT_USER',
        user,
        isFallback: false,
        resolutionOrigin: 'Chỉ định trực tiếp',
        allowOverride: mapping.allowOverride,
        required: mapping.required,
        isMultiInstance: mapping.isMultiInstance,
        collectionVariable: mapping.collectionVariable,
      };
    }

    // 2. Trường hợp DYNAMIC_RULE: Phân giải theo quy tắc
    const config = mapping.ruleConfig as DynamicActorRuleConfig;
    const targetTitle = (config as any).title || config.targetJobTitle || '';
    const deptRef = config.departmentName || (config as any).department || config.departmentId;
    let resolvedUser: UserEntity | null = null;
    let isFallback = false;

    // Lấy thông tin người nộp đơn
    const requestor = await this.prisma.user.findUnique({
      where: { id: requestorId },
      include: {
        organizationMembers: {
          include: { organization: true },
          where: { isActive: true },
        },
      },
    });

    if (!requestor) {
      throw new NotFoundException(`Không tìm thấy người nộp đơn với ID ${requestorId}`);
    }

    switch (config.ruleType) {
      case 'DIRECT_MANAGER': {
        resolvedUser = await this.resolveDirectManager(requestor);
        break;
      }
      case 'DEPARTMENT_TITLE': {
        resolvedUser = await this.resolveDepartmentTitle(deptRef, targetTitle);
        break;
      }
      case 'REQUESTOR_DEPT_TITLE': {
        const dept = requestor.department || requestor.organizationMembers?.[0]?.organization?.name;
        resolvedUser = await this.resolveDepartmentTitle(dept, targetTitle);
        break;
      }
      default:
        this.logger.warn(`Unknown ruleType "${config.ruleType}", falling back to default`);
        break;
    }

    // 3. Nếu không tìm thấy, thực thi Chiến lược Fallback
    if (!resolvedUser) {
      isFallback = true;
      resolvedUser = await this.executeFallback(config, requestor, mapping.taskName);
    }

    let resolutionOrigin = 'Tự động phân giải theo quy tắc';
    if (isFallback) {
      if (config.fallbackStrategy === 'PARENT_MANAGER') {
        resolutionOrigin = 'Dự phòng (Quản lý cấp trên): Chuyển người thay thế';
      } else if (config.fallbackStrategy === 'SPECIFIC_USER') {
        resolutionOrigin = 'Dự phòng (Nhân sự chỉ định): Chuyển người thay thế';
      } else {
        resolutionOrigin = 'Dự phòng: Chuyển người thay thế';
      }
    } else if (config.ruleType === 'DIRECT_MANAGER') {
      resolutionOrigin = 'Tự động phân giải: Trưởng phòng trực tiếp của bạn';
    } else if (config.ruleType === 'DEPARTMENT_TITLE') {
      resolutionOrigin = `Tự động phân giải: ${targetTitle || 'Chức danh'} (${config.departmentName || deptRef || 'Phòng ban'})`;
    } else if (config.ruleType === 'REQUESTOR_DEPT_TITLE') {
      resolutionOrigin = `Tự động phân giải: ${targetTitle || 'Chức danh'} cùng phòng của bạn`;
    }

    return {
      taskDefinitionKey: mapping.taskDefinitionKey,
      taskName: mapping.taskName,
      order: mapping.order,
      assigneeType: 'DYNAMIC_RULE',
      ruleType: config.ruleType,
      user: resolvedUser,
      isFallback,
      resolutionOrigin,
      allowOverride: mapping.allowOverride,
      required: mapping.required,
      isMultiInstance: mapping.isMultiInstance,
      collectionVariable: mapping.collectionVariable,
    };
  }

  /**
   * Phân giải toàn bộ danh sách tác nhân cho một phiên bản Thủ tục.
   */
  async resolveActorsForProcedure(
    procedureVersionId: string,
    requestorId: string,
  ): Promise<ResolvedActorResult[]> {
    const mappings = await this.prisma.procedureActorMapping.findMany({
      where: { procedureVersionId },
      include: { defaultUser: true },
      orderBy: { order: 'asc' },
    });

    const results: ResolvedActorResult[] = [];
    for (const m of mappings) {
      const resolved = await this.resolveActor(m, requestorId);
      results.push(resolved);
    }
    return results;
  }

  // ── Helper resolution algorithms ──────────────────────────────────────────

  /**
   * Tìm Trưởng phòng / Quản lý trực tiếp của người nộp đơn.
   */
  private async resolveDirectManager(requestor: any): Promise<UserEntity | null> {
    const primaryMembership = requestor.organizationMembers?.[0];
    if (!primaryMembership?.organizationId) {
      // Nếu user chưa có liên kết organization_members, thử tìm theo User.department
      if (requestor.department) {
        const org = await this.prisma.organization.findFirst({
          where: { name: requestor.department },
          include: {
            members: {
              where: { role: 'manager', isActive: true },
              include: { user: true },
            },
          },
        });
        const mgr = org?.members?.find((m) => m.userId !== requestor.id)?.user;
        if (mgr) return mgr;
      }
      return null;
    }

    const orgId = primaryMembership.organizationId;
    // Tìm manager trong cùng node phòng ban
    const managers = await this.prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        role: 'manager',
        isActive: true,
      },
      include: { user: true },
    });

    // Tránh self-approval: nếu người nộp đơn chính là Manager, ưu tiên người khác hoặc leo lên cấp cha
    const validManager = managers.find((m) => m.userId !== requestor.id)?.user;
    if (validManager) return validManager;

    // Nếu người nộp đơn là manager duy nhất, leo lên cấp cha của organization
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (org?.parentId) {
      return this.findParentManager(org.parentId, requestor.id);
    }

    return null;
  }

  /**
   * Tìm User có chức danh cụ thể tại phòng ban chỉ định.
   */
  private async resolveDepartmentTitle(
    departmentNameOrId?: string | null,
    targetTitle?: string | null,
  ): Promise<UserEntity | null> {
    if (!departmentNameOrId || !targetTitle) return null;

    // Tìm theo department name và title trong bảng users
    let user = await this.prisma.user.findFirst({
      where: {
        department: { equals: departmentNameOrId, mode: 'insensitive' },
        title: { equals: targetTitle, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (user) return user;

    // Tìm qua liên kết Organization nếu departmentNameOrId là UUID
    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [{ id: departmentNameOrId }, { name: departmentNameOrId }],
      },
      include: {
        members: {
          include: { user: true },
          where: { isActive: true },
        },
      },
    });

    if (org) {
      const match = org.members.find(
        (m) => m.user.title?.toLowerCase() === targetTitle.toLowerCase(),
      );
      if (match?.user) return match.user;
    }

    return null;
  }

  /**
   * Thực thi chiến lược Fallback khi không tìm thấy người theo quy tắc.
   */
  private async executeFallback(
    config: DynamicActorRuleConfig,
    requestor: any,
    taskName: string,
  ): Promise<UserEntity> {
    switch (config.fallbackStrategy) {
      case 'SPECIFIC_USER': {
        if (config.fallbackUserId) {
          const user = await this.prisma.user.findUnique({
            where: { id: config.fallbackUserId },
          });
          if (user) return user;
        }
        break;
      }
      case 'BLOCK_SUBMISSION': {
        throw new BadRequestException(
          `Không thể phân giải người duyệt cho bước "${taskName}". Vui lòng liên hệ Quản trị viên cập nhật chức danh/phòng ban.`,
        );
      }
      case 'PARENT_MANAGER':
      default: {
        // Leo lên cấp cha
        const orgId = requestor.organizationMembers?.[0]?.organizationId;
        if (orgId) {
          const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
          if (org?.parentId) {
            const parentMgr = await this.findParentManager(org.parentId, requestor.id);
            if (parentMgr) return parentMgr;
          }
        }

        // Nếu đã ở cấp cao nhất hoặc không có cha, fallback về Giám đốc hoặc Admin hệ thống
        const adminUser = await this.prisma.user.findFirst({
          where: { role: 'admin', isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (adminUser) return adminUser;
        break;
      }
    }

    // Cuối cùng: fallback an toàn về tài khoản admin đầu tiên
    const systemAdmin = await this.prisma.user.findFirst({
      where: { role: 'admin', isActive: true },
    });
    if (!systemAdmin) {
      throw new BadRequestException(`Không tìm thấy nhân sự dự phòng cho bước "${taskName}"`);
    }
    return systemAdmin;
  }

  /**
   * Đệ quy tìm Manager ở các node tổ chức cấp trên.
   */
  private async findParentManager(
    currentOrgId: string,
    excludeUserId: string,
  ): Promise<UserEntity | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: currentOrgId },
      include: {
        members: {
          where: { role: 'manager', isActive: true },
          include: { user: true },
        },
      },
    });

    if (!org) return null;

    const mgr = org.members.find((m) => m.userId !== excludeUserId)?.user;
    if (mgr) return mgr;

    if (org.parentId) {
      return this.findParentManager(org.parentId, excludeUserId);
    }

    return null;
  }
}
