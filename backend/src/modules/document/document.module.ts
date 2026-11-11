import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentStorageService } from './document-storage.service';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, DocumentStorageService],
  exports: [DocumentService],
})
export class DocumentModule {}
