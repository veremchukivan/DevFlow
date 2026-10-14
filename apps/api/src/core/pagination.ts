import type { PageInfo, PaginationQuery } from "@devflow/shared";

export function buildPageInfo(input: PaginationQuery & { total: number }): PageInfo {
  return {
    hasNextPage: input.offset + input.limit < input.total,
    limit: input.limit,
    offset: input.offset,
    total: input.total
  };
}
