import useSWRInfinite from 'swr/infinite';
import { apiFetcher } from '@/lib/api';

export type PaginatedResponse<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
};

export function usePagination<T>(
  baseUrl: string,
  params?: Record<string, string>
): {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: unknown;
  mutate: () => void;
} {
  const getKey = (
    pageIndex: number,
    previousPageData: PaginatedResponse<T> | null
  ): string | null => {
    if (previousPageData && !previousPageData.has_more) return null;

    const p: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) p[k] = v; });
    }
    if (pageIndex > 0 && previousPageData?.next_cursor) {
      p.cursor = previousPageData.next_cursor;
    }

    const qs = new URLSearchParams(p).toString();
    return `${baseUrl}${qs ? `?${qs}` : ''}`;
  };

  const { data: pages, isLoading, isValidating, error, mutate, size, setSize } =
    useSWRInfinite<PaginatedResponse<T>>(getKey, apiFetcher);

  const data = pages?.flatMap((p) => p.data) ?? [];
  const hasMore = pages?.[pages.length - 1]?.has_more ?? false;
  const isLoadingMore = isValidating && !isLoading && size > (pages?.length ?? 0);

  function loadMore() {
    void setSize((s) => s + 1);
  }

  return { data, isLoading, isLoadingMore, hasMore, loadMore, error, mutate };
}
