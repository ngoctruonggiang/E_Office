import { Module } from '@nestjs/common';
import { ApprovalFlowModule } from '../approval-flow/approval-flow.module';
import { DocumentModule } from '../document/document.module';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';

@Module({
  imports: [ApprovalFlowModule, DocumentModule],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
