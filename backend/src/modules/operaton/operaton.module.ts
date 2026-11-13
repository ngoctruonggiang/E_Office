import { Module } from '@nestjs/common';
import { BpmnParserService } from './bpmn-parser.service';
import { OperatonClientService } from './operaton-client.service';
import { OperatonController } from './operaton.controller';
import { OperatonService } from './operaton.service';

@Module({
  controllers: [OperatonController],
  providers: [BpmnParserService, OperatonClientService, OperatonService],
  exports: [BpmnParserService, OperatonClientService, OperatonService],
})
export class OperatonModule {}

