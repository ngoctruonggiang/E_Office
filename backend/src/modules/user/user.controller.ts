import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../../core/common/decorators/api-paginated-response.decorator';
import { Roles } from '../../core/common/decorators/roles.decorator';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';

/**
 * Profile endpoints. Protected by the global JwtAuthGuard — only the
 * authenticated user can read/update their own profile.
 */
@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** List users, paginated and optionally filtered by id/displayName/email. */
  @Get()
  @ApiOperation({
    summary: 'List users',
    description:
      'Pass ?id=, ?displayName=, or ?email= to filter; ?page= and ?limit= to paginate.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  async list(
    @Query() query: ListUsersQueryDto,
  ): Promise<Paginated<UserResponseDto>> {
    const { items, meta } = await this.userService.findAll(query);
    return { items: items.map((u) => UserResponseDto.fromEntity(u)), meta };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const entity = await this.userService.getByIdOrThrow(user.userId);
    return UserResponseDto.fromEntity(entity);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const entity = await this.userService.updateProfile(user.userId, dto);
    return UserResponseDto.fromEntity(entity);
  }

  // ── Admin account management ────────────────────────────────────────────
  // Guarded by RolesGuard + @Roles('admin'). The profile routes above stay
  // open to any authenticated user.

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new account (admin)' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  async adminCreate(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const entity = await this.userService.adminCreate(dto);
    return UserResponseDto.fromEntity(entity);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Update an account — display name, role, active status (admin)',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  async adminUpdate(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ): Promise<UserResponseDto> {
    const entity = await this.userService.updateUser(id, dto);
    return UserResponseDto.fromEntity(entity);
  }

  @Post(':id/password')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Reset an account's password (admin)" })
  @ApiNoContentResponse({ description: 'Password updated.' })
  @ApiForbiddenResponse({ description: 'Requires the admin role.' })
  async adminSetPassword(
    @Param('id') id: string,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    await this.userService.setPassword(id, dto.password);
  }
}
