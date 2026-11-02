import { loadTicketSourceStats, splitTicketSourceStatsIds } from './ticketStats'

describe('Ticket source Post stats batching', () => {
  it('loads more than 100 linked source Posts in complete batches', async () => {
    const postInnerIds = Array.from({ length: 205 }, (_, index) => index + 1)
    const batches: number[][] = []
    const loadBatch = vi.fn(async (batch: readonly number[]) => {
      batches.push([...batch])
      return batch.map((innerId) => ({ innerId }))
    })

    const stats = await loadTicketSourceStats(postInnerIds, loadBatch)

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5])
    expect(batches.flat()).toEqual(postInnerIds)
    expect(stats.map(({ innerId }) => innerId)).toEqual(postInnerIds)
    expect(loadBatch).toHaveBeenCalledTimes(3)
    expect(splitTicketSourceStatsIds([])).toEqual([])
  })
})
