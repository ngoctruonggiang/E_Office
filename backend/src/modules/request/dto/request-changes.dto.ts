import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/**
 * Body for the requestor's "revise" action (after an approver set the request
 * to REQUEST_CHANGES): which clone strategy to use.
 */
export class RequestChangesDto {
  @ApiProperty({
    enum: ['reset', 'reserve'],
    description:
      'reset → fresh DRAFT clone (no approvals); reserve → clone re-opened at the step where changes were requested, keeping earlier approvals.',
  })
  @IsIn(['reset', 'reserve'])
  mode!: 'reset' | 'reserve';
}
