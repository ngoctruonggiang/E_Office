import { basename } from 'path';
import type { Response } from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { SigningService } from './signing.service';
import { CreateEnvelopeDto } from './dto/create-envelope.dto';
import { AddRecipientDto } from './dto/add-recipient.dto';
import { AddFieldDto } from './dto/add-field.dto';
import { ListEnvelopesQueryDto } from './dto/list-envelopes-query.dto';
import { EnvelopeResponseDto } from './dto/envelope-response.dto';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

@ApiTags('signing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('signing/envelopes')
export class SigningController {
  constructor(private readonly signing: SigningService) {}

  // ── Owner ──────────────────────────────────────────────────────────────
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PDF_BYTES },
    }),
  )
  @ApiOperation({
    summary: 'Owner: create a signing envelope from an uploaded PDF',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({ type: EnvelopeResponseDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateEnvelopeDto,
  ): Promise<EnvelopeResponseDto> {
    if (!file) {
      throw new BadRequestException('A PDF file is required');
    }
    return this.signing.createEnvelope(user.userId, file, dto.title);
  }

  @Post(':id/recipients')
  @ApiOperation({ summary: 'Owner: add a signer (gafood user) to the envelope' })
  @ApiParam({ name: 'id', description: 'Envelope id' })
  @ApiOkResponse({ type: EnvelopeResponseDto })
  addRecipient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddRecipientDto,
  ): Promise<EnvelopeResponseDto> {
    return this.signing.addRecipient(user.userId, id, dto.userId);
  }

  @Post(':id/fields')
  @ApiOperation({ summary: 'Owner: place a signature field for a recipient' })
  @ApiParam({ name: 'id', description: 'Envelope id' })
  @ApiOkResponse({ type: EnvelopeResponseDto })
  addField(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddFieldDto,
  ): Promise<EnvelopeResponseDto> {
    return this.signing.addField(user.userId, id, dto);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Owner: send the envelope for signing' })
  @ApiParam({ name: 'id', description: 'Envelope id' })
  @ApiOkResponse({ type: EnvelopeResponseDto })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EnvelopeResponseDto> {
    return this.signing.sendEnvelope(user.userId, id);
  }

  // ── List / detail / download (involved users) ────────────────────────────
  @Get()
  @ApiOperation({
    summary: 'List envelopes I own or must sign (filter with ?role=)',
  })
  @ApiOkResponse({ type: [EnvelopeResponseDto] })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEnvelopesQueryDto,
  ): Promise<EnvelopeResponseDto[]> {
    return this.signing.listEnvelopes(user.userId, query.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Envelope detail (recipients, fields, status)' })
  @ApiParam({ name: 'id', description: 'Envelope id' })
  @ApiOkResponse({ type: EnvelopeResponseDto })
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<EnvelopeResponseDto> {
    return this.signing.getEnvelopeOrThrow(user.userId, id);
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download the (signed when complete, else original) PDF',
  })
  @ApiParam({ name: 'id', description: 'Envelope id' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename } = await this.signing.getDownload(user.userId, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
        basename(filename),
      )}`,
    });
    return new StreamableFile(stream);
  }
}
