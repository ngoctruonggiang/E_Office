import { Module } from '@nestjs/common';
import { ApprovalFlowController } from './approval-flow.controller';
import { ApprovalEngineService } from './approval-engine.service';

@Module({
  controllers: [ApprovalFlowController],
  providers: [ApprovalEngineService],
  exports: [ApprovalEngineService],
})
export class ApprovalFlowModule {}
