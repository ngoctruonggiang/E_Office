import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { OperatonModule } from '../operaton/operaton.module';
import { ProcedureController } from './procedure.controller';
import { ProcedureValidationService } from './procedure-validation.service';
import { ProcedureService } from './procedure.service';

@Module({
  imports: [PrismaModule, OperatonModule],
  controllers: [ProcedureController],
  providers: [ProcedureValidationService, ProcedureService],
  exports: [ProcedureValidationService, ProcedureService],
})
export class ProcedureModule {}

