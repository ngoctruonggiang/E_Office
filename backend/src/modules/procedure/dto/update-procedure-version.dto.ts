import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ProcedureActorMappingDto {
  @ApiProperty({ description: 'BPMN task definition ID', example: 'step_department_head' })
  @IsNotEmpty()
  @IsString()
  taskDefinitionKey: string;

  @ApiProperty({ description: 'Task name label', example: 'Trưởng phòng phê duyệt' })
  @IsNotEmpty()
  @IsString()
  taskName: string;

  @ApiProperty({ description: 'Execution order', example: 1 })
  @IsInt()
  order: number;

  @ApiProperty({
    description: 'Assignee strategy',
    enum: ['DIRECT_USER', 'DYNAMIC_RULE'],
    default: 'DIRECT_USER',
  })
  @IsIn(['DIRECT_USER', 'DYNAMIC_RULE'])
  assigneeType: 'DIRECT_USER' | 'DYNAMIC_RULE';

  @ApiPropertyOptional({
    description: 'User ID for DIRECT_USER assignment',
    example: 'user-uuid-1234',
  })
  @IsOptional()
  @IsString()
  defaultUserId?: string | null;

  @ApiPropertyOptional({ description: 'Rule configuration for DYNAMIC_RULE' })
  @IsOptional()
  ruleConfig?: any;

  @ApiProperty({
    description: 'Whether the requester is allowed to override/change the assignee at runtime',
    default: true,
  })
  @IsBoolean()
  allowOverride: boolean;

  @ApiProperty({
    description: 'Whether this step requires an assignee (cannot be skipped)',
    default: true,
  })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is a multi-instance user task',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isMultiInstance?: boolean;

  @ApiPropertyOptional({
    description: 'Collection variable name in BPMN for multi-instance tasks',
    example: 'actorList_reviewers',
  })
  @IsOptional()
  @IsString()
  collectionVariable?: string | null;
}

export class ProcedureVariableMappingDto {
  @ApiProperty({
    description: 'Variable name in BPMN condition expression',
    example: 'var_amount',
  })
  @IsNotEmpty()
  @IsString()
  operatonVarName: string;

  @ApiProperty({
    description: 'Field key from FormVersion.fields',
    example: 'tong_tien_de_xuat',
  })
  @IsNotEmpty()
  @IsString()
  formFieldKey: string;

  @ApiProperty({
    description: 'Target data type for casting to Operaton',
    enum: ['NUMBER', 'STRING', 'BOOLEAN'],
    default: 'NUMBER',
  })
  @IsIn(['NUMBER', 'STRING', 'BOOLEAN'])
  variableType: 'NUMBER' | 'STRING' | 'BOOLEAN';

  @ApiPropertyOptional({
    description: 'Fallback value if field is empty or null',
    example: '0',
  })
  @IsOptional()
  @IsString()
  fallbackValue?: string | null;
}

export class UpdateProcedureVersionDto {
  @ApiPropertyOptional({
    description: 'FormVersion ID to link',
    example: 'fv-uuid-1234',
  })
  @IsOptional()
  @IsString()
  formVersionId?: string;

  @ApiPropertyOptional({
    description: 'Operaton Process Definition ID',
    example: 'Process_e_office_purchase_flow_1:1:55d4d38c-bf87-11f0-9289-0242ac140003',
  })
  @IsOptional()
  @IsString()
  operatonDefinitionId?: string;

  @ApiProperty({
    description: 'List of actor mappings for UserTasks in the workflow',
    type: [ProcedureActorMappingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureActorMappingDto)
  actorMappings: ProcedureActorMappingDto[];

  @ApiProperty({
    description: 'List of variable mappings for branching conditions',
    type: [ProcedureVariableMappingDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcedureVariableMappingDto)
  variableMappings: ProcedureVariableMappingDto[];
}

