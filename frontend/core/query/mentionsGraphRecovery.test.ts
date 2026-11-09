import { GraphQLRequestError } from '~/graphql/client'

import { isMentionsGraphRestartError, readMentionsGraphWithRestart } from './mentionsGraphRecovery'

const failure = (code: number) =>
  new GraphQLRequestError(Response.json({}), [{ message: 'graph rejected', extensions: { code } }])

it('restarts a cursor-free revision race once, without changing the shared retry policy', async () => {
  const read = vi.fn().mockRejectedValueOnce(failure(4553)).mockResolvedValue('fresh')
  await expect(readMentionsGraphWithRestart(read, false)).resolves.toBe('fresh')
  expect(read).toHaveBeenCalledTimes(2)
})

it('stops after the second rejected attempt', async () => {
  const error = failure(4553)
  const read = vi.fn().mockRejectedValue(error)
  await expect(readMentionsGraphWithRestart(read, false)).rejects.toBe(error)
  expect(read).toHaveBeenCalledTimes(2)
})

it('never replays an invalid cursor or retries unrelated domain and transport errors', async () => {
  for (const [code, cursor] of [
    [4551, true],
    [4553, true],
    [4551, false],
    [4549, false],
    [4550, false],
    [4554, false],
  ] as const) {
    const error = failure(code)
    const read = vi.fn().mockRejectedValue(error)
    await expect(readMentionsGraphWithRestart(read, cursor)).rejects.toBe(error)
    expect(read).toHaveBeenCalledTimes(1)
  }
  expect(isMentionsGraphRestartError(new Error('4553'))).toBe(false)
})

it('respects cancellation between attempts', async () => {
  const controller = new AbortController()
  const error = failure(4553)
  const read = vi.fn(async () => {
    controller.abort()
    throw error
  })
  await expect(readMentionsGraphWithRestart(read, false, controller.signal)).rejects.toBe(error)
  expect(read).toHaveBeenCalledTimes(1)
})
