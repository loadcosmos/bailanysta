export const SEARCH_DEBOUNCE_MS = 250;

export function normalizeSearchQuery(value: string) {
  return value.trim().slice(0, 60);
}

export function isLatestSearch(requestId: number, latestRequestId: number) {
  return requestId === latestRequestId;
}
