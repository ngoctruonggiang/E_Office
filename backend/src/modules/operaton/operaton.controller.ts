import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../core/common/decorators/roles.decorator';
import { RolesGuard } from '../../core/common/guards/roles.guard';
import { DeployWorkflowDto, QueryDefinitionsDto } from './dto/deploy-workflow.dto';
import { OperatonService } from './operaton.service';
import {
  DeployBpmnResult,
  OperatonHealthStatus,
  OperatonProcessDefinitionSummary,
  ParsedBpmnStructure,
} from './operaton.types';

@ApiTags('operaton')
@ApiBearerAuth()
@Controller('operaton')
@UseGuards(RolesGuard)
export class OperatonController {
  constructor(private readonly operatonService: OperatonService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check connectivity to Operaton BPMN Engine' })
  @ApiOkResponse({ description: 'Engine connectivity and version info' })
  async getHealth(): Promise<OperatonHealthStatus> {
    return this.operatonService.getHealth();
  }

  @Get('definitions')
  @Roles('admin', 'ADMIN', 'super_admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List deployed workflows filtered by category (default: e-Office)' })
  @ApiOkResponse({ description: 'List of process definitions' })
  async getDefinitions(
    @Query() query: QueryDefinitionsDto,
  ): Promise<OperatonProcessDefinitionSummary[]> {
    const latestOnly = query.latestOnly !== false;
    return this.operatonService.getDefinitions(query.category, latestOnly);
  }

  @Get('definitions/:id/xml')
  @Roles('admin', 'ADMIN', 'super_admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get raw BPMN 2.0 XML for a deployed process' })
  @ApiParam({ name: 'id', description: 'Process definition ID' })
  @ApiOkResponse({ description: 'BPMN XML string' })
  async getDefinitionXml(@Param('id') id: string): Promise<{ bpmn20Xml: string }> {
    const xml = await this.operatonService.getDefinitionXml(id);
    return { bpmn20Xml: xml };
  }

  @Get('definitions/:id/structure')
  @Roles('admin', 'ADMIN', 'super_admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get parsed structure (Tasks, Gateways, Variables) from BPMN XML' })
  @ApiParam({ name: 'id', description: 'Process definition ID' })
  @ApiOkResponse({ description: 'Parsed BPMN Structure' })
  async getDefinitionStructure(@Param('id') id: string): Promise<ParsedBpmnStructure> {
    return this.operatonService.getDefinitionStructure(id);
  }

  @Post('deploy')
  @Roles('admin', 'ADMIN', 'super_admin', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Deploy a BPMN workflow from Web Modeler or XML' })
  @ApiCreatedResponse({ description: 'Deployment result with new definition ID' })
  async deployWorkflow(
    @Body() dto: DeployWorkflowDto,
  ): Promise<DeployBpmnResult> {
    return this.operatonService.deployWorkflow(dto);
  }
}

