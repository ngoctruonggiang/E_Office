import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ActualActorItemDto {
  @ApiProperty({ description: 'BPMN UserTask definition key', example: 'Activity_DeptHeadApprove' })
  @IsString()
  @IsNotEmpty()
  taskDefinitionKey: string;

  @ApiProperty({ description: 'Assigned user UUID', example: 'usr-uuid-1' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiPropertyOptional({ description: 'Execution order', example: 1 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class UpdateActualActorsDto {
  @ApiProperty({ type: [ActualActorItemDto], description: 'List of approver assignments' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualActorItemDto)
  actors: ActualActorItemDto[];
}

