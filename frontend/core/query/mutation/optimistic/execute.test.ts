import { QueryClient } from '@tanstack/react-query'

import * as optimisticEffects from './effects'
import { commitOptimisticCache, prepareOptimisticCache } from './errors'
import { executeCommand, executeOptimisticOperation } from './execute'
import { enqueueOptimisticToggle } from './toggle'
import type {
  TOptimisticChange,
  TOptimisticPlan,
  TOptimisticOperation,
  TOptimisticToggleOperation,
} from './types'

const emptyPlan: TOptimisticPlan = { changes: [] }

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

  it('executes an operation without an optimistic prepare step', async () => {
    const queryClient = new QueryClient()
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.command-only',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      execute: async () => 'confirmed',
      reconcile: () => undefined,
    }

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
      }),
    ).resolves.toBe('confirmed')
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
      authorityTargets: () => [],
      prepare: (): TOptimisticPlan => {
        events.push('prepare')
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
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      input: 1,
    })
    await vi.waitFor(() => expect(events).toEqual(['cancel', 'prepare', 'execute:1']))

    const second = executeOptimisticOperation({
      queryClient,
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      input: 2,
    })
    expect(events).toEqual(['cancel', 'prepare', 'execute:1'])

    releaseFirst?.()
    await expect(first).resolves.toBe(1)
    await expect(second).resolves.toBe(2)
    expect(events).toEqual([
      'cancel',
      'prepare',
      'execute:1',
      'reconcile:1',
      'cancel',
      'prepare',
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
      authorityTargets: () => [],
      prepare: (_context, _target, next) => {
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
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      next: true,
    })
    await vi.waitFor(() => expect(requests).toHaveLength(1))

    const second = enqueueOptimisticToggle({
      queryClient,
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      next: false,
    })
    expect(second.created).toBe(false)
    expect(second.promise).toBe(first.promise)
    expect(applied).toEqual([true])

    requests.shift()?.(true)
    await vi.waitFor(() => expect(requests).toHaveLength(1))
    expect(applied).toEqual([true, false])
    requests.shift()?.(false)

    await expect(first.promise).resolves.toBe(false)
  })

  it('stops after the shared request fails and discards the in-flight latest intent', async () => {
    const queryClient = new QueryClient()
    const requests: boolean[] = []
    const operation: TOptimisticToggleOperation<{ id: string }, boolean> = {
      name: 'test.toggle.failure',
      entityKey: (target) => target.id,
      read: () => false,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => emptyPlan,
      execute: async (_context, _target, next) => {
        requests.push(next)
        throw new Error('first failed')
      },
      reconcile: () => undefined,
    }

    const first = enqueueOptimisticToggle({
      queryClient,
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      next: true,
    })
    const joined = enqueueOptimisticToggle({
      queryClient,
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      next: false,
    })

    expect(first.created).toBe(true)
    expect(joined.created).toBe(false)
    expect(joined.promise).toBe(first.promise)
    await expect(first.promise).rejects.toMatchObject({ message: 'first failed' })
    expect(requests).toEqual([true])
  })

  it('degrades a recognized prepare failure and schedules calibration without waiting for it', async () => {
    const queryClient = new QueryClient()
    const events: string[] = []
    let releaseCalibration: (() => void) | undefined
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      () =>
        new Promise((resolve) => {
          events.push('calibrate')
          releaseCalibration = () => resolve(undefined as never)
        }),
    )
    const operation: TOptimisticOperation<{ id: string }, string, string> = {
      name: 'test.prepare-failure',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [{ queryKey: ['inflight'], exact: true }],
      authorityTargets: () => [{ queryKey: ['authority'] }, { queryKey: ['authority'] }],
      prepare: () =>
        prepareOptimisticCache(() => {
          events.push('prepare')
          throw new Error('malformed cached shape')
        }),
      execute: async () => {
        events.push('execute')
        throw new Error('request failed')
      },
      reconcile: () => undefined,
    }
    vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async () => {
      events.push('cancel')
      return undefined as never
    })

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: 'valid command',
      }),
    ).rejects.toMatchObject({ message: 'request failed' })

    expect(events).toEqual(['cancel', 'prepare', 'execute', 'calibrate'])
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['authority'],
      exact: true,
      refetchType: 'active',
    })
    releaseCalibration?.()
  })

  it('starts prepare-failure calibration only after the command has settled and reconciled', async () => {
    const queryClient = new QueryClient()
    const events: string[] = []
    let finishCommand: ((result: string) => void) | undefined
    let markCommandStarted: (() => void) | undefined
    const commandStarted = new Promise<void>((resolve) => {
      markCommandStarted = resolve
    })
    const command = new Promise<string>((resolve) => {
      finishCommand = resolve
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => {
      events.push('calibrate')
      return undefined as never
    })
    const operation: TOptimisticOperation<{ id: string }, string, string> = {
      name: 'test.prepare-failure-order',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [{ queryKey: ['inflight'], exact: true }],
      authorityTargets: () => [{ queryKey: ['authority'] }],
      prepare: () =>
        prepareOptimisticCache(() => {
          events.push('prepare')
          throw new Error('malformed cached shape')
        }),
      execute: () => {
        events.push('execute-start')
        markCommandStarted?.()
        return command
      },
      reconcile: () => events.push('reconcile'),
    }
    vi.spyOn(queryClient, 'cancelQueries').mockImplementation(async () => {
      events.push('cancel')
      return undefined as never
    })

    const execution = executeOptimisticOperation({
      queryClient,
      accountScope: 'acct-a',
      operation,
      target: { id: '42' },
      input: 'valid command',
    })
    await commandStarted

    expect(events).toEqual(['cancel', 'prepare', 'execute-start'])
    expect(invalidate).not.toHaveBeenCalled()

    finishCommand?.('confirmed')
    await expect(execution).resolves.toBe('confirmed')
    expect(events).toEqual(['cancel', 'prepare', 'execute-start', 'reconcile', 'calibrate'])
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it('cleans multiple landed writes after the second commit throws, then sends the command', async () => {
    const queryClient = new QueryClient()
    const firstKey = ['first']
    const secondKey = ['second']
    queryClient.setQueryData(firstKey, 'before-first')
    queryClient.setQueryData(secondKey, 'before-second')
    const events: string[] = []
    let releaseCalibration: (() => void) | undefined
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      () =>
        new Promise((resolve) => {
          events.push('calibrate')
          releaseCalibration = () => resolve(undefined as never)
        }),
    )
    const commandId = 'cmd-partial-commit'
    const changes: TOptimisticChange[] = [
      {
        type: 'field',
        queryKey: firstKey,
        entityKey: 'entity',
        field: 'first',
        before: 'before-first',
        optimistic: 'after-first',
        commandId,
        rollback: 'restore-if-owned-and-value-matches',
        commit: () =>
          commitOptimisticCache(() => {
            queryClient.setQueryData(firstKey, 'after-first')
            events.push('write-first')
          }),
        restore: () => {
          events.push('restore-first-failed')
          throw new Error('restore failed')
        },
      },
      {
        type: 'field',
        queryKey: secondKey,
        entityKey: 'entity',
        field: 'second',
        before: 'before-second',
        optimistic: 'after-second',
        commandId,
        rollback: 'restore-if-owned-and-value-matches',
        commit: () =>
          commitOptimisticCache(() => {
            queryClient.setQueryData(secondKey, 'after-second')
            events.push('write-second')
            throw new Error('subscriber failed after data landed')
          }),
        restore: () => {
          if (queryClient.getQueryData(secondKey) === 'after-second') {
            queryClient.setQueryData(secondKey, 'before-second')
            events.push('restore-second')
          }
        },
      },
    ]
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.partial-commit',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [{ queryKey: ['authority'] }],
      prepare: () => ({ changes }),
      execute: async () => {
        events.push('execute')
        return 'confirmed'
      },
      reconcile: () => undefined,
    }

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
        commandId,
      }),
    ).resolves.toBe('confirmed')

    expect(events).toEqual([
      'write-first',
      'write-second',
      'restore-first-failed',
      'restore-second',
      'execute',
      'calibrate',
    ])
    expect(queryClient.getQueryData(firstKey)).toBe('after-first')
    expect(queryClient.getQueryData(secondKey)).toBe('before-second')
    expect(invalidate).toHaveBeenCalledOnce()
    releaseCalibration?.()
  })

  it('keeps a confirmed result when ownership marker cleanup throws', async () => {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    vi.spyOn(optimisticEffects, 'clearChanges').mockImplementation(() => {
      throw new Error('marker cleanup failed')
    })
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.marker-cleanup-failure',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [{ queryKey: ['authority'] }],
      prepare: () => emptyPlan,
      execute: async () => 'confirmed',
      reconcile: () => undefined,
    }

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
      }),
    ).resolves.toBe('confirmed')
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it('does not downgrade an unclassified preparation error into a command', async () => {
    const queryClient = new QueryClient()
    const execute = vi.fn(async () => 'sent')
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.invalid-input',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [],
      prepare: () => {
        throw new Error('invalid business input')
      },
      execute,
      reconcile: () => undefined,
    }

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
      }),
    ).rejects.toMatchObject({ message: 'invalid business input' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns the confirmed result while reconcile fails and calibration is pending', async () => {
    const queryClient = new QueryClient()
    let releaseCalibration: (() => void) | undefined
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseCalibration = () => resolve(undefined as never)
        }),
    )
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.confirmed-reconcile-failure',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [{ queryKey: ['authority'] }],
      prepare: () => emptyPlan,
      execute: async () => 'confirmed',
      reconcile: () => {
        throw new Error('local reconcile failed')
      },
    }
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
      }),
    ).resolves.toBe('confirmed')

    expect(diagnostic).toHaveBeenCalled()
    releaseCalibration?.()
  })

  it('keeps a confirmed result when the calibration scheduler rejects', async () => {
    const queryClient = new QueryClient()
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValueOnce(
      new Error('calibration scheduler failed'),
    )
    const operation: TOptimisticOperation<{ id: string }, void, string> = {
      name: 'test.confirmed-calibration-rejection',
      entityKey: ({ id }) => id,
      queriesToCancel: () => [],
      authorityTargets: () => [{ queryKey: ['authority'] }],
      prepare: () => emptyPlan,
      execute: async () => 'confirmed',
      reconcile: () => {
        throw new Error('local reconcile failed')
      },
    }
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(
      executeOptimisticOperation({
        queryClient,
        accountScope: 'acct-a',
        operation,
        target: { id: '42' },
        input: undefined,
      }),
    ).resolves.toBe('confirmed')
    await vi.waitFor(() => expect(diagnostic).toHaveBeenCalledTimes(2))
  })
})
