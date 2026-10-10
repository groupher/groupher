import { QueryClient } from '@tanstack/react-query'

import { executeCommand, executeOptimisticOperation } from './execute'
import { enqueueOptimisticToggle } from './toggle'
import type { TOptimisticPlan, TOptimisticOperation, TOptimisticToggleOperation } from './types'

const emptyPlan: TOptimisticPlan = { changes: [], refetchOnFailure: [] }

describe('optimistic operation executor', () => {
  it('creates one command identity at the transport boundary and reuses an injected identity', async () => {
    const requests: string[] = []
    const request = async (variables: { value: string; commandId: string }) => {
      requests.push(variables.commandId)
      return variables.value
    }

    await expect(executeCommand({ request, variables: { value: 'first' } })).resolves.toBe('first')
    await expect(
      executeCommand({ request, variables: { value: 'first' }, commandId: requests[0] }),
    ).resolves.toBe('first')

    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(requests[1]).toBe(requests[0])
  })

  it('cancels affected queries and serializes one queue lane', async () => {
    const queryClient = new QueryClient()
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue()
    const events: string[] = []
    const resolveFirst = vi.fn<() => void>()
    let releaseFirst: (() => void) | undefined
    const operation: TOptimisticOperation<{ id: string }, number, number> = {
      name: 'test.action',
      entityKey: (target: { id: string }) => target.id,
      queueKey: () => 'article:42:comments',
      queriesToCancel: () => {
        events.push('cancel')
        return [{ queryKey: ['article', '42'], exact: true }]
      },
      apply: (): TOptimisticPlan => {
        events.push('apply')
        return emptyPlan
      },
      execute: async (_context, _target, input) => {
        events.push(`execute:${input}`)
        if (input === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
          resolveFirst()
        }
        return input
      },
      reconcile: (_context, _target, input) => {
        events.push(`reconcile:${input}`)
      },
    }

    const first = executeOptimisticOperation({
      queryClient,
      accountRef: 'acct-a',
      operation,
      target: { id: '42' },
      input: 1,
    })
    await vi.waitFor(() => expect(events).toEqual(['cancel', 'apply', 'execute:1']))

    const second = executeOptimisticOperation({
      queryClient,
      accountRef: 'acct-a',
      operation,
      target: { id: '42' },
      input: 2,
    })
    expect(events).toEqual(['cancel', 'apply', 'execute:1'])

    releaseFirst?.()
    await expect(first).resolves.toBe(1)
    await expect(second).resolves.toBe(2)
    expect(events).toEqual([
      'cancel',
      'apply',
      'execute:1',
      'reconcile:1',
      'cancel',
      'apply',
      'execute:2',
      'reconcile:2',
    ])
    expect(cancelQueries).toHaveBeenCalledTimes(2)
    expect(resolveFirst).toHaveBeenCalledOnce()
  })

  it('coalesces a toggle to the latest target while the first request is pending', async () => {
    const queryClient = new QueryClient()
    const requests: Array<(value: boolean) => void> = []
    const applied: boolean[] = []
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle',
      entityKey: (target) => target.id,
      queueKey: () => 'article:42:reaction',
      read: () => false,
      queriesToCancel: () => [],
      apply: (_context, _target, next) => {
        applied.push(next)
        return emptyPlan
      },
      execute: async (_context, _target, next) =>
        new Promise<boolean>((resolve) => {
          requests.push(() => resolve(next))
        }),
      reconcile: () => undefined,
    }

    const first = enqueueOptimisticToggle({
      queryClient,
      accountRef: 'acct-a',
      operation,
      target: { id: '42' },
      next: true,
    })
    await vi.waitFor(() => expect(requests).toHaveLength(1))

    const second = enqueueOptimisticToggle({
      queryClient,
      accountRef: 'acct-a',
      operation,
      target: { id: '42' },
      next: false,
    })
    expect(second).toBe(first)
    expect(applied).toEqual([true])

    requests.shift()?.(true)
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(applied).toEqual([true, false])
    requests.shift()?.(false)

    await expect(first).resolves.toBe(false)
  })
})
