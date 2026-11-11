import { Module } from '@nestjs/common';
import { SigningController } from './signing.controller';
import { SigningService } from './signing.service';
import { DocumensoClient } from './documenso.client';
import { StorageClient } from './storage.client';

@Module({
  controllers: [SigningController],
  providers: [SigningService, DocumensoClient, StorageClient],
  exports: [SigningService],
})
export class SigningModule {}
