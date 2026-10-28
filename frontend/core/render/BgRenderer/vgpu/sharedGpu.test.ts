const mocks = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('vgpu', () => mocks)

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const createGpu = () => {
  const lost = deferred<{ reason: string }>()
  return { gpu: { gpu: { lost: lost.promise }, dispose: vi.fn() }, lost }
}

describe('shared wallpaper GPU', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })
  afterEach(() => vi.useRealTimers())

  it('shares initialization and keeps other previews alive until the final lease releases', async () => {
    const first = createGpu().gpu
    const second = createGpu().gpu
    mocks.init.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const { acquireWallpaperGpu } = await import('./sharedGpu')
    const leases = await Promise.all(Array.from({ length: 3 }, () => acquireWallpaperGpu()))
    expect(mocks.init).toHaveBeenCalledTimes(1)
    expect(leases.every((lease) => lease.gpu === first)).toBe(true)
    leases[0].release()
    leases[0].release()
    leases[1].release()
    expect(first.dispose).not.toHaveBeenCalled()
    leases[2].release()
    expect(first.dispose).toHaveBeenCalledTimes(1)
    const next = await acquireWallpaperGpu()
    expect(next.gpu).toBe(second)
    next.release()
    expect(second.dispose).toHaveBeenCalledTimes(1)
  })

  it('retries after shared initialization fails', async () => {
    const pending = deferred<never>()
    mocks.init.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(createGpu().gpu)
    const { acquireWallpaperGpu } = await import('./sharedGpu')
    const results = Promise.allSettled([acquireWallpaperGpu(), acquireWallpaperGpu()])
    pending.reject(new Error('adapter failed'))
    expect((await results).every((result) => result.status === 'rejected')).toBe(true)
    const next = await acquireWallpaperGpu()
    expect(mocks.init).toHaveBeenCalledTimes(2)
    next.release()
  })

  it('replaces a lost device without letting old leases dispose the replacement', async () => {
    const first = createGpu()
    const second = createGpu()
    mocks.init.mockResolvedValueOnce(first.gpu).mockResolvedValueOnce(second.gpu)
    const { acquireWallpaperGpu } = await import('./sharedGpu')
    const oldLease = await acquireWallpaperGpu()
    first.lost.resolve({ reason: 'unknown' })
    await first.lost.promise
    const replacement = await acquireWallpaperGpu()
    expect(replacement.gpu).toBe(second.gpu)
    oldLease.release()
    expect(first.gpu.dispose).toHaveBeenCalledTimes(1)
    expect(second.gpu.dispose).not.toHaveBeenCalled()
    replacement.release()
  })

  it('times out all waiters and disposes a late device exactly once', async () => {
    vi.useFakeTimers()
    const late = createGpu().gpu
    const pending = deferred<typeof late>()
    mocks.init.mockReturnValueOnce(pending.promise)
    const { acquireWallpaperGpu } = await import('./sharedGpu')
    const results = Promise.allSettled([acquireWallpaperGpu(), acquireWallpaperGpu()])
    await vi.advanceTimersByTimeAsync(10_001)
    for (const result of await results) {
      expect(result).toMatchObject({
        status: 'rejected',
        reason: { message: expect.stringContaining('BG_VGPU_INIT_TIMEOUT') },
      })
    }
    pending.resolve(late)
    await vi.advanceTimersByTimeAsync(0)
    expect(late.dispose).toHaveBeenCalledTimes(1)
  })
})
