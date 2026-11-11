import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export type EnvelopeRole = 'owner' | 'assignee' | 'viewer';

export class ListEnvelopesQueryDto {
  @ApiPropertyOptional({
    enum: ['owner', 'assignee', 'viewer'],
    description:
      'owner = envelopes I created; assignee = envelopes I must sign; viewer = all envelopes I can see (default).',
  })
  @IsOptional()
  @IsIn(['owner', 'assignee', 'viewer'])
  role?: EnvelopeRole;
}
