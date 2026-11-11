import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApprovalEngineService } from './approval-engine.service';
import { FlowStatusDto } from './dto/flow-status.dto';

/**
 * Read-only view of a request's approval progress. The acting endpoint
 * (approve/reject) lives on the request controller (`POST /requests/:id/approval`).
 */
@ApiTags('approval-flows')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('approval-flows')
export class ApprovalFlowController {
  constructor(private readonly engine: ApprovalEngineService) {}

  /** get by requestId — check the request's approval status. */
  @Get(':requestId')
  @ApiOperation({ summary: "Get a request's approval status" })
  @ApiParam({ name: 'requestId', description: 'Request id' })
  @ApiOkResponse({ type: FlowStatusDto })
  getStatus(@Param('requestId') requestId: string): Promise<FlowStatusDto> {
    return this.engine.getStatus(requestId);
  }
}
