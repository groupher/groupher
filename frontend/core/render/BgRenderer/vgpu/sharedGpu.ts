import { init } from 'vgpu'
import type { Gpu } from 'vgpu'

const GPU_INIT_TIMEOUT_MS = 10_000

type TEntry = {
  users: number
  gpu?: Gpu
  pending: Promise<Gpu>
}

export type TWallpaperGpuLease = { gpu: Gpu; release: () => void }

let current: TEntry | undefined

const initGpuWithTimeout = async (): Promise<Gpu> => {
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const pending = init({ label: 'wallpaper-runtime', powerPreference: 'high-performance' })
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          reject(new Error(`BG_VGPU_INIT_TIMEOUT: WebGPU init exceeded ${GPU_INIT_TIMEOUT_MS}ms`))
        }, GPU_INIT_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    if (timedOut) void pending.then((gpu) => gpu.dispose()).catch(() => undefined)
  }
}

/** Keeps one device (and vgpu's pipeline cache) alive while editor previews hold leases. */
export const acquireWallpaperGpu = async (): Promise<TWallpaperGpuLease> => {
  if (!current) {
    const entry: TEntry = { users: 0, pending: initGpuWithTimeout() }
    current = entry
    entry.pending = entry.pending.then(
      (gpu) => {
        entry.gpu = gpu
        void gpu.gpu.lost.then(() => {
          if (current === entry) current = undefined
        })
        return gpu
      },
      (error) => {
        if (current === entry) current = undefined
        throw error
      },
    )
  }
  const entry = current
  entry.users += 1
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    entry.users -= 1
    if (entry.users === 0) {
      if (current === entry) current = undefined
      entry.gpu?.dispose()
    }
  }
  try {
    return { gpu: await entry.pending, release }
  } catch (error) {
    release()
    throw error
  }
}
