import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import { Roles } from '../../core/common/decorators/roles.decorator';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { ListProceduresQueryDto } from './dto/list-procedures-query.dto';
import { UpdateProcedureVersionDto } from './dto/update-procedure-version.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { ProcedureService } from './procedure.service';
import {
  UserDirectoryItem,
  ValidationResult,
} from './procedure.types';

@ApiTags('procedures')
@ApiBearerAuth()
@Controller('procedures')
@UseGuards(RolesGuard)
export class ProcedureController {
  constructor(private readonly procedureService: ProcedureService) {}

  // ── Helper Endpoints (placed before :id to prevent route clash) ──

  @Get('helpers/directory')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get active users directory with department & title' })
  @ApiOkResponse({ description: 'List of users for actor assignment autocomplete' })
  async getDirectory(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
  ): Promise<UserDirectoryItem[]> {
    return this.procedureService.getDirectory(search, departmentId);
  }

  @Get('helpers/forms')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get available forms and their versions' })
  @ApiOkResponse({ description: 'List of forms with versions and fields' })
  async getHelperForms() {
    return this.procedureService.getHelperForms();
  }

  @Get('helpers/workflows')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get available Operaton workflows (category: e-Office)' })
  @ApiOkResponse({ description: 'List of process definitions from Operaton' })
  async getHelperWorkflows() {
    return this.procedureService.getHelperWorkflows();
  }

  // ── Version Specific Endpoints ─────────────────────────────────

  @Get('versions/:versionId')
  @ApiOperation({ summary: 'Get full configuration details of a ProcedureVersion' })
  @ApiParam({ name: 'versionId', description: 'ProcedureVersion UUID' })
  @ApiOkResponse({ description: 'Detailed version config with mappings & workflow' })
  async getVersionById(@Param('versionId') versionId: string) {
    return this.procedureService.getVersionById(versionId);
  }

  @Put('versions/:versionId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update draft configuration (Form, Workflow, Actors, Variables)' })
  @ApiParam({ name: 'versionId', description: 'ProcedureVersion UUID (must be DRAFT)' })
  @ApiOkResponse({ description: 'Updated ProcedureVersion' })
  async updateDraftVersion(
    @Param('versionId') versionId: string,
    @Body() dto: UpdateProcedureVersionDto,
  ) {
    return this.procedureService.updateDraftVersion(versionId, dto);
  }

  @Post('versions/:versionId/validate')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Validate draft version against pre-publish rules' })
  @ApiParam({ name: 'versionId', description: 'ProcedureVersion UUID' })
  @ApiOkResponse({ description: 'Validation results with errors and warnings' })
  async validateVersion(
    @Param('versionId') versionId: string,
  ): Promise<ValidationResult> {
    return this.procedureService.validateVersion(versionId);
  }

  @Post('versions/:versionId/publish')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Publish procedure version (version pinning)' })
  @ApiParam({ name: 'versionId', description: 'ProcedureVersion UUID (must be DRAFT)' })
  @ApiOkResponse({ description: 'Publication result with pinned version' })
  async publishVersion(
    @Param('versionId') versionId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.procedureService.publishVersion(versionId, userId);
  }

  // ── Procedure Root Endpoints ───────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List procedures with pagination, search and filter' })
  @ApiOkResponse({ description: 'Paginated procedures list' })
  async findAll(
    @Query() query: ListProceduresQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.procedureService.findAll(query, user.role);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new procedure and initialize draft v1' })
  @ApiCreatedResponse({ description: 'Procedure created with initial draft version' })
  async create(
    @Body() dto: CreateProcedureDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.procedureService.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get procedure by ID' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  @ApiOkResponse({ description: 'Procedure details with active version' })
  async findById(@Param('id') id: string) {
    return this.procedureService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update procedure metadata' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  @ApiOkResponse({ description: 'Updated procedure' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProcedureDto,
  ) {
    return this.procedureService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete procedure' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  @ApiOkResponse({ description: 'Deleted procedure' })
  async delete(@Param('id') id: string) {
    return this.procedureService.delete(id);
  }

  @Get(':id/versions')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all versions of a procedure' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  @ApiOkResponse({ description: 'List of procedure versions' })
  async getVersions(@Param('id') id: string) {
    return this.procedureService.getVersions(id);
  }

  @Post(':id/draft')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new draft version cloned from latest/active version' })
  @ApiParam({ name: 'id', description: 'Procedure UUID' })
  @ApiCreatedResponse({ description: 'New draft version created' })
  async createDraft(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.procedureService.createDraftVersion(id, userId);
  }
}
