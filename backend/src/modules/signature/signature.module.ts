import { Module } from '@nestjs/common';
import { ApprovalFlowModule } from '../approval-flow/approval-flow.module';
import { OperatonModule } from '../operaton/operaton.module';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';

@Module({
  imports: [ApprovalFlowModule, OperatonModule],
  controllers: [SignatureController],
  providers: [SignatureService],
  exports: [SignatureService],
})
export class SignatureModule {}
