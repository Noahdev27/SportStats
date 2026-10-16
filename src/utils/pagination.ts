import type { PaginationMeta } from '../types/common.schema.js';

export const toSkipTake = ({ page, limit }: { page: number; limit: number }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const buildPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
