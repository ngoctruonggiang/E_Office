import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { RequestValueInput } from './create-request.dto';

/** Update only the form field values of a request (not its status/flow). */
export class UpdateRequestDto {
  @ApiProperty({ type: () => RequestValueInput, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestValueInput)
  values!: RequestValueInput[];
}
