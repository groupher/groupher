import { draw } from 'vgpu'
import type { Gpu } from 'vgpu'

import './wgsl-env.d.ts'
import wallpaperMeshShader from './wallpaper-mesh.wgsl'

/** Only renderer/texture selection affects compilation; slider values stay uniforms. */
export const getWallpaperVariantKey = (params: Record<string, unknown>): string =>
  `${params.meshModel ?? 0}:${params.textureType ?? 0}`

/** Uses pipeline overrides so the driver can discard all unselected effect branches. */
export const createWallpaperMesh = (
  gpu: Gpu,
  params: Record<string, unknown>,
  label = 'wallpaper-runtime-mesh',
) =>
  draw(gpu, {
    shader: wallpaperMeshShader,
    constants: { '0': Number(params.meshModel ?? 0), '1': Number(params.textureType ?? 0) },
    label,
    set: { params },
  })
