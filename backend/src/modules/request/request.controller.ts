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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { RequestService } from './request.service';
import { DocumentService } from '../document/document.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { RequestChangesDto } from './dto/request-changes.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';
import { ForwardDto } from './dto/forward.dto';
import { AddViewersDto } from './dto/add-viewers.dto';
import { ApprovalActionDto } from '../approval-flow/dto/approval-action.dto';
import {
  RequestDetailDto,
  RequestSummaryDto,
} from './dto/request-response.dto';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';
import { FlowStatusDto } from '../approval-flow/dto/flow-status.dto';

/**
 * Requests = filled-in forms (EAV). Each request carries its own approval
 * flow, built by the requester on create; assignees act via POST :id/approval.
 */
@ApiTags('requests')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('requests')
export class RequestController {
  constructor(
    private readonly requests: RequestService,
    private readonly documents: DocumentService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a request by filling in a form' })
  @ApiCreatedResponse({ type: RequestDetailDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRequestDto,
  ): Promise<RequestDetailDto> {
    return this.requests.create(user.userId, dto);
  }

  // ── static list routes BEFORE :id to avoid route shadowing ─────────────

  /** Requests I created, optionally filtered + paginated. */
  @Get('mine')
  @ApiOperation({
    summary: 'List requests I created',
    description:
      'Pass ?formId= or ?status= to filter; ?page= and ?limit= to paginate.',
  })
  @ApiPaginatedResponse(RequestSummaryDto)
  getMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    return this.requests.getMine(user.userId, query);
  }

  /** Requests where I have a pending task (my duty), optionally filtered + paginated. */
  @Get('duty')
  @ApiOperation({
    summary: 'List requests where I have a pending task',
    description:
      'Pass ?formId= or ?status= to filter; ?page= and ?limit= to paginate.',
  })
  @ApiPaginatedResponse(RequestSummaryDto)
  getByDuty(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    return this.requests.getByDuty(user.userId, query);
  }

  /** Requests I can view (excludes my own), optionally filtered + paginated. */
  @Get('viewable')
  @ApiOperation({
    summary: 'List requests I can view (excludes my own)',
    description:
      'Pass ?formId= or ?status= to filter; ?page= and ?limit= to paginate.',
  })
  @ApiPaginatedResponse(RequestSummaryDto)
  getByViewer(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRequestsQueryDto,
  ): Promise<Paginated<RequestSummaryDto>> {
    return this.requests.getByViewer(user.userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a request with its EAV values and full approval flow',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  getOne(@Param('id') id: string): Promise<RequestDetailDto> {
    return this.requests.getOne(id);
  }

  /** Clone lineage: previous versions of this request, oldest → newest. */
  @Get(':id/history')
  @ApiOperation({
    summary: 'Clone history (ancestor chain) of a request',
    description:
      'Walks clonedFromId back to the original; the current request is the last entry.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestSummaryDto, isArray: true })
  getHistory(@Param('id') id: string): Promise<RequestSummaryDto[]> {
    return this.requests.getHistory(id);
  }

  /** Update field values only (creator, while editable). */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update field values (creator, while editable)',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
  ): Promise<RequestDetailDto> {
    return this.requests.update(user.userId, id, dto);
  }

  /** clone-reserve — copy values + carry over prior approvals. */
  @Post(':id/clone-reserve')
  @ApiOperation({
    summary: 'Clone a request, carrying over prior approvals',
  })
  @ApiParam({ name: 'id', description: 'Request id to clone' })
  @ApiCreatedResponse({ type: RequestDetailDto })
  cloneReserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RequestDetailDto> {
    return this.requests.cloneReserve(user.userId, id);
  }

  /** clone-reset — copy values, fresh state. */
  @Post(':id/clone-reset')
  @ApiOperation({ summary: 'Clone a request with fresh approval state' })
  @ApiParam({ name: 'id', description: 'Request id to clone' })
  @ApiCreatedResponse({ type: RequestDetailDto })
  cloneReset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RequestDetailDto> {
    return this.requests.cloneReset(user.userId, id);
  }

  /** Approve / reject / act on the request's current step. */
  @Post(':id/approval')
  @ApiOperation({
    summary: "Act on the request's current approval step",
    description:
      'For APPROVE / REQUEST_CHANGES / REJECT / CANCEL / COMPLETE. REQUEST_CHANGES sends the request back to the requestor (status REQUEST_CHANGES). Use the dedicated endpoint for FORWARD.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: FlowStatusDto })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApprovalActionDto,
  ): Promise<FlowStatusDto> {
    return this.requests.approve(user.userId, id, dto);
  }

  /** Revise (requestor) — clone (reset|reserve) and cancel the original. */
  @Post(':id/revise')
  @ApiOperation({
    summary: 'Revise a request after changes were requested (requestor only)',
    description:
      'Valid while the request is REQUEST_CHANGES. Clones it (reset|reserve), the original becomes CANCELLED, and the returned clone is the new active request.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiCreatedResponse({ type: RequestDetailDto })
  revise(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequestChangesDto,
  ): Promise<RequestDetailDto> {
    return this.requests.revise(user.userId, id, dto.mode);
  }

  /** Submit a DRAFT (requestor) — finalize a cloned draft and start its flow. */
  @Post(':id/submit')
  @ApiOperation({
    summary: 'Submit a draft request (requestor only)',
    description:
      'Finalizes a DRAFT (e.g. a cloned draft after editing): replaces viewers, (re)builds the approval flow from the body, and starts it.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitDraftDto,
  ): Promise<RequestDetailDto> {
    return this.requests.submitDraft(user.userId, id, dto);
  }

  /** Cancel directly (requestor) — independent of the flow. */
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a request directly (requestor only)',
    description:
      'Valid while DRAFT / PENDING / REQUEST_CHANGES. Cancels pending tasks and sets the request to CANCELLED.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RequestDetailDto> {
    return this.requests.cancelByRequestor(user.userId, id);
  }

  /** Request changes on own request (requestor) — pull a PENDING request back. */
  @Post(':id/request-changes')
  @ApiOperation({
    summary: 'Pull a pending request back for changes (requestor only)',
    description:
      'Valid while PENDING. Sets the request to REQUEST_CHANGES and cancels pending approver tasks so the requestor can revise / resubmit.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  requestChangesSelf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RequestDetailDto> {
    return this.requests.requestChangesByRequestor(user.userId, id);
  }

  /** Add viewers — requestor (manage) or approval assignee (share). */
  @Post(':id/viewers')
  @ApiOperation({
    summary: 'Add viewers to the request',
    description:
      'The requestor may add anyone; an approval assignee may share by adding more viewers (assignees cannot remove). The creator is never added.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: RequestDetailDto })
  addViewers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddViewersDto,
  ): Promise<RequestDetailDto> {
    return this.requests.addViewers(user.userId, id, dto.userIds);
  }

  /** Remove a viewer — requestor only. */
  @Delete(':id/viewers/:userId')
  @ApiOperation({
    summary: 'Remove a viewer from the request (requestor only)',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiParam({ name: 'userId', description: 'Viewer user id to remove' })
  @ApiOkResponse({ type: RequestDetailDto })
  removeViewer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<RequestDetailDto> {
    return this.requests.removeViewer(user.userId, id, userId);
  }

  /**
   * Remove an attached document from the request. Creator-only; main documents
   * may only be removed while the request is a draft (craft mode).
   */
  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove an attached document from the request (requestor only)',
    description:
      'Detaches the document and soft-deletes it. Main documents may only be removed while the request is a draft.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiParam({ name: 'documentId', description: 'Document id to remove' })
  @ApiNoContentResponse()
  removeDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    return this.documents.detachFromRequest(user.userId, id, documentId);
  }

  /** FORWARD — reassign the caller's current task to another user. */
  @Post(':id/forward')
  @ApiOperation({
    summary: 'Forward: reassign the current approval task to another user',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: FlowStatusDto })
  forward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ForwardDto,
  ): Promise<FlowStatusDto> {
    return this.requests.forward(user.userId, id, dto.toUserId);
  }
}
