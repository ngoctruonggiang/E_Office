import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { FlowStatusDto } from '../approval-flow/dto/flow-status.dto';
import { SignatureService } from './signature.service';
import { SetSignatureDto } from './dto/set-signature.dto';
import { SignatureStateDto } from './dto/signature-response.dto';

/**
 * Online signing for a request: the requestor places approver signature boxes
 * on a chosen document; approvers sign (or reject) through the document, which
 * drives the approval flow.
 */
@ApiTags('signature')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('requests/:id/signature')
export class SignatureController {
  constructor(private readonly signature: SignatureService) {}

  @Get()
  @ApiOperation({ summary: 'Get the signing document + boxes for a request' })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: SignatureStateDto })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SignatureStateDto> {
    return this.signature.getForRequest(user.userId, id);
  }

  @Put()
  @ApiOperation({
    summary: 'Set the signing document + approver boxes (requestor, from scratch)',
    description:
      'Replaces the signing document and ALL signature boxes, wiping any prior positions and sign state. Pass documentId=null with an empty fields array to clear signing.',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: SignatureStateDto })
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetSignatureDto,
  ): Promise<SignatureStateDto> {
    return this.signature.setFields(user.userId, id, dto);
  }

  @Post('sign')
  @ApiOperation({
    summary: 'Sign the document and approve (current approver)',
    description:
      "Stamps the caller's boxes with their profile signature and marks their approval task done, advancing the flow.",
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: FlowStatusDto })
  sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FlowStatusDto> {
    return this.signature.sign(user.userId, id);
  }

  @Post('reject')
  @ApiOperation({
    summary: 'Reject through the document and reject the request (approver)',
  })
  @ApiParam({ name: 'id', description: 'Request id' })
  @ApiOkResponse({ type: FlowStatusDto })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FlowStatusDto> {
    return this.signature.reject(user.userId, id);
  }
}
