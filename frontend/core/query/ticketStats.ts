export const TICKET_SOURCE_STATS_BATCH_SIZE = 100

/** Splits Post Community numbers into ArticleStats requests within the backend limit. */
export const splitTicketSourceStatsIds = (postInnerIds: readonly number[]): number[][] => {
  const batches: number[][] = []
  for (let index = 0; index < postInnerIds.length; index += TICKET_SOURCE_STATS_BATCH_SIZE) {
    batches.push(postInnerIds.slice(index, index + TICKET_SOURCE_STATS_BATCH_SIZE))
  }
  return batches
}

/** Loads all linked Post stats in bounded batches and preserves the supplied ID order. */
export const loadTicketSourceStats = async <T>(
  postInnerIds: readonly number[],
  loadBatch: (batch: readonly number[]) => Promise<readonly T[]>,
): Promise<T[]> => {
  const batches = splitTicketSourceStatsIds(postInnerIds)
  const results = await Promise.all(batches.map(loadBatch))
  return results.flatMap((batch) => [...batch])
}
