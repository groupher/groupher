import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite'

/** Creates the shared WGSL transform used by every Vite host that can bundle Core backgrounds. */
export const createVgpuWgslVitePlugin = () =>
  wgslVitePlugin({ minify: process.env.NODE_ENV === 'production' })
