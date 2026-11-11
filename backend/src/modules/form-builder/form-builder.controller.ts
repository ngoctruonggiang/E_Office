import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '../../core/common/decorators/api-paginated-response.decorator';
import { Paginated } from '../../core/common/dto/pagination-meta.dto';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { FormBuilderService } from './form-builder.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { AddOptionDto } from './dto/add-option.dto';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import { FormDetailDto, FormSummaryDto } from './dto/form-detail.dto';

/**
 * Form builder: forms are generic request templates. A form has versions;
 * changing field types / adding fields produces a new version while existing
 * requests keep their original version.
 */
@ApiTags('forms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('forms')
export class FormBuilderController {
  constructor(private readonly formBuilder: FormBuilderService) {}

  /** List form categories — pick one to start a request. */
  @Get()
  @ApiOperation({
    summary: 'List form categories',
    description: 'Pass ?name= to filter; ?page= and ?limit= to paginate.',
  })
  @ApiPaginatedResponse(FormSummaryDto)
  list(@Query() query: ListFormsQueryDto): Promise<Paginated<FormSummaryDto>> {
    return this.formBuilder.listForms(query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a form (request template)' })
  @ApiCreatedResponse({ type: FormDetailDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFormDto,
  ): Promise<FormDetailDto> {
    return this.formBuilder.createForm(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a form',
    description:
      'If a field changes type or a new key appears, a new version is created; otherwise the current version is updated in place.',
  })
  @ApiParam({ name: 'id', description: 'Form id' })
  @ApiOkResponse({ type: FormDetailDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
  ): Promise<FormDetailDto> {
    return this.formBuilder.updateForm(id, dto);
  }

  /** add_item — append an option to a SELECT field. */
  @Post(':id/fields/:fieldId/options')
  @ApiOperation({ summary: 'Append an option to a SELECT field' })
  @ApiParam({ name: 'id', description: 'Form id' })
  @ApiParam({ name: 'fieldId', description: 'Field id' })
  @ApiOkResponse({ type: FormDetailDto })
  addOption(
    @Param('id') id: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: AddOptionDto,
  ): Promise<FormDetailDto> {
    return this.formBuilder.addOption(id, fieldId, dto);
  }

  /** Assembled latest version for rendering in the frontend. */
  @Get(':id')
  @ApiOperation({ summary: "Get a form's latest version" })
  @ApiParam({ name: 'id', description: 'Form id' })
  @ApiOkResponse({ type: FormDetailDto })
  get(@Param('id') id: string): Promise<FormDetailDto> {
    return this.formBuilder.getForm(id);
  }
}
