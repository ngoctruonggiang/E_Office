import { Module } from '@nestjs/common';
import { ApprovalFlowModule } from '../approval-flow/approval-flow.module';
import { DocumentModule } from '../document/document.module';
import { OperatonModule } from '../operaton/operaton.module';
import { FlowSimulationService } from './flow-simulation.service';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';

@Module({
  imports: [ApprovalFlowModule, DocumentModule, OperatonModule],
  controllers: [RequestController],
  providers: [RequestService, FlowSimulationService],
  exports: [RequestService, FlowSimulationService],
})
export class RequestModule {}
