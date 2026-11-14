import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { OperatonModule } from '../operaton/operaton.module';
import { ProcedureController } from './procedure.controller';
import { ProcedureValidationService } from './procedure-validation.service';
import { ProcedureService } from './procedure.service';
import { ActorResolverService } from './actor-resolver.service';

@Module({
  imports: [PrismaModule, OperatonModule],
  controllers: [ProcedureController],
  providers: [ProcedureValidationService, ProcedureService, ActorResolverService],
  exports: [ProcedureValidationService, ProcedureService, ActorResolverService],
})
export class ProcedureModule {}

