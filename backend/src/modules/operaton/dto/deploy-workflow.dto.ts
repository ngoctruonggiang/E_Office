import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeployWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  deploymentName!: string;

  @IsString()
  @IsNotEmpty()
  category: string = 'e-Office';

  @IsString()
  @IsNotEmpty()
  bpmnXml!: string;
}

export class QueryDefinitionsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  latestOnly?: boolean;
}

