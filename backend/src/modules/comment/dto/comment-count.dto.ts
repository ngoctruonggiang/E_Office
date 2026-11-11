import { ApiProperty } from '@nestjs/swagger';

/** Number of (non-deleted) comments scoped to one approval step / the feed. */
export class CommentCountDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Approval step order; null = the request-level feed.',
  })
  stepOrder!: number | null;

  @ApiProperty({ description: 'Number of non-deleted comments in this scope.' })
  count!: number;
}
