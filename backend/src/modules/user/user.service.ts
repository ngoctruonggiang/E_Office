import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import { buildMeta, toSkipTake } from '../../core/common/utils/pagination.util';
import { UserEntity } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

/** bcrypt cost factor — kept in sync with the auth provider. */
const BCRYPT_ROUNDS = 12;

/**
 * Owns all persistence for users. The auth layer depends on this service
 * (through the AuthProvider) rather than touching Prisma directly.
 */
@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    email: string;
    passwordHash: string;
    displayName?: string | null;
  }): Promise<UserEntity> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName ?? null,
      },
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /** Count users with a given system role (used by the admin bootstrap). */
  async countByRole(role: string): Promise<number> {
    return this.prisma.user.count({ where: { role } });
  }

  /**
   * Admin-side account creation. Hashes the password here and enforces email
   * uniqueness with a friendly 409 (the unique index is the real guard).
   */
  async adminCreate(data: {
    email: string;
    password: string;
    displayName?: string | null;
    role?: string;
  }): Promise<UserEntity> {
    const email = data.email.toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: data.displayName ?? null,
        role: data.role ?? 'user',
      },
    });
  }

  /** Admin update of account fields (display name / role / active status). */
  async updateUser(
    id: string,
    dto: { displayName?: string | null; role?: string; isActive?: boolean },
  ): Promise<UserEntity> {
    await this.getByIdOrThrow(id);
    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName === '' ? null : dto.displayName;
    }
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return this.prisma.user.update({ where: { id }, data });
  }

  /** Admin password reset for an arbitrary account. */
  async setPassword(id: string, newPassword: string): Promise<UserEntity> {
    await this.getByIdOrThrow(id);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Paginated list of users, optionally filtered by id, displayName, or email. */
  async findAll(query: ListUsersQueryDto): Promise<Paginated<UserEntity>> {
    const { skip, take, page, limit } = toSkipTake(query);
    const where: Prisma.UserWhereInput = {
      ...(query.id ? { id: query.id } : {}),
      ...(query.displayName
        ? { displayName: { contains: query.displayName, mode: 'insensitive' } }
        : {}),
      ...(query.email
        ? { email: { contains: query.email, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, meta: buildMeta(total, page, limit) };
  }

  /** Same as findById but throws 404 when missing — for profile endpoints. */
  async getByIdOrThrow(id: string): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserEntity> {
    await this.getByIdOrThrow(id);
    // Only touch fields actually present in the payload. An empty string is a
    // deliberate "clear" (→ null) for the signature fields.
    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.signatureName !== undefined) {
      data.signatureName = dto.signatureName === '' ? null : dto.signatureName;
    }
    if (dto.signatureImage !== undefined) {
      data.signatureImage =
        dto.signatureImage === '' ? null : dto.signatureImage;
    }
    return this.prisma.user.update({ where: { id }, data });
  }
}
