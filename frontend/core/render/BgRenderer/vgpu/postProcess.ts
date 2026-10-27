import { effect, target } from 'vgpu'
import type { Effect, Frame, Gpu, Target } from 'vgpu'

import './wgsl-env.d.ts'
import wallpaperPostShader from './wallpaper-post.wgsl'

/** Shares the bounded generation/texture-filter pipeline between preview and export. */
export const createWallpaperPostProcess = (gpu: Gpu) => {
  // Preserve procedural highlights until brightness/saturation and final output clamping.
  const scene = target(gpu, { size: [1, 1], format: 'rgba16float', label: 'wallpaper-scene' })
  const sampler = gpu.gpu.createSampler({
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    minFilter: 'linear',
    magFilter: 'linear',
  })
  const post = effect(gpu, wallpaperPostShader, { label: 'wallpaper-post' })

  return {
    scene,
    compile: (output: Target) =>
      post.compile({ colors: [output.format], sampleCount: output.sampleCount }),
    update: (size: readonly [number, number], params: Record<string, unknown>) => {
      if (scene.size[0] !== size[0] || scene.size[1] !== size[1]) scene.resize(size)
      post.set({
        params: {
          resolution: size,
          blurRadius: params.blurRadius,
          brightness: params.globalBrightness,
          saturation: params.globalSaturation,
        },
        wallpaperSampler: sampler,
        wallpaperTexture: scene.color,
      })
    },
    encode: (currentFrame: Frame, output: Target, mesh: Effect) => {
      currentFrame.pass(scene, mesh)
      currentFrame.pass(output, post)
    },
    destroy: () => scene.color.destroy(),
  }
}
