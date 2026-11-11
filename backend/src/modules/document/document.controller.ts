import { basename } from 'path';
import type { Response } from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../core/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/auth-provider.interface';
import { Roles } from '../../core/common/decorators/roles.decorator';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentNameDto } from './dto/update-document-name.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { documentStorage, MAX_UPLOAD_BYTES } from './multer.config';

@ApiTags('documents')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  /** Upload a file, optionally attaching it to a request. */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: documentStorage,
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  @ApiOperation({
    summary: 'Upload a file',
    description: 'Max file size 20 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        requestId: {
          type: 'string',
          description: 'Optional request to attach this document to.',
        },
        name: {
          type: 'string',
          description: 'Display name; defaults to the original filename.',
        },
        type: { type: 'string', description: 'DocumentType enum value.' },
      },
    },
  })
  @ApiOkResponse({ type: DocumentResponseDto })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.documents.upload(user.userId, file, dto);
  }

  /** Document metadata (name, size, type) — used to render attachment lists. */
  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiOkResponse({ type: DocumentResponseDto })
  getOne(@Param('id') id: string): Promise<DocumentResponseDto> {
    return this.documents.getOne(id);
  }

  /** Stream the file for download. */
  @Get(':id/download')
  @ApiOperation({ summary: 'Download a document file' })
  @ApiParam({ name: 'id', description: 'Document id' })
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const doc = await this.documents.getForDownload(id);
    const filename = encodeURIComponent(doc.name || basename(doc.filePath));
    res.set({
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    });
    return new StreamableFile(await this.documents.openStream(doc.filePath));
  }

  @Patch(':id/name')
  @ApiOperation({ summary: 'Rename a document' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiOkResponse({ type: DocumentResponseDto })
  updateName(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentNameDto,
  ): Promise<DocumentResponseDto> {
    return this.documents.updateName(user.userId, id, dto.name);
  }

  /** Soft delete (sets deletedFlag). */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a document (sets deletedFlag)' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiNoContentResponse()
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documents.softDelete(user.userId, id);
  }

  /** Hard delete — admin only. */
  @Delete(':id/hard')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a document (admin only)' })
  @ApiParam({ name: 'id', description: 'Document id' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Caller is not an admin.' })
  hardDelete(@Param('id') id: string): Promise<void> {
    return this.documents.hardDelete(id);
  }
}
