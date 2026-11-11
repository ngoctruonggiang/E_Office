import { PaginationMetaDto } from '../dto/pagination-meta.dto';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

/** Prisma `skip`/`take` for a page, plus the normalized page/limit used. */
export function toSkipTake(query: PaginationQueryDto): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
