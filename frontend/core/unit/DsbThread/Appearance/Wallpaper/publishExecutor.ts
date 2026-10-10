import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'

import { ASSETS_HUB_READ_ENDPOINT } from '~/config'
import { browserGraphQLRequest } from '~/graphql/client'
import type { WallpaperProfile, WallpaperTheme } from '~/lib/graphql/generated/graphql'
import type { TExportedImageVariant } from '~/render/ImageExport'
import { exportWallpaperBatch } from '~/render/WallpaperExport'
import { uploadGeneratedImage } from '~/unit/DsbThread/AssetsHub/uploadGeneratedImage'

import type { TWallpaperPublishPlan } from './publishPlan'
import S from './schema'

type TGeneratedUploadIntent = {
  capability: string
  profile: string
  uploadRef: string
}

type TPreparedBatch = NonNullable<
  ResultOf<typeof S.prepareWallpaperUpload>['prepareWallpaperUpload']
>

type TGraphqlRequest = typeof browserGraphQLRequest

export type TWallpaperPublishExecutorDeps = {
  exportBatch: typeof exportWallpaperBatch
  graphqlRequest: TGraphqlRequest
  createBatch: (capability: string) => Promise<void>
  uploadImage: typeof uploadGeneratedImage
  cancelBatch: (batchRef: string, capability: string) => Promise<void>
  hasWebGPU: () => boolean
}

const toGraphqlTheme = (theme: 'light' | 'dark'): WallpaperTheme =>
  theme === 'dark' ? 'DARK' : 'LIGHT'

const toGraphqlProfile = (profile: string): WallpaperProfile =>
  profile.toUpperCase() as WallpaperProfile

const createAssetsHubBatch = async (capability: string): Promise<void> => {
  const response = await fetch(`${ASSETS_HUB_READ_ENDPOINT}/generated-batches`, {
    body: JSON.stringify({ capability }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GENERATED_IMAGE_BATCH_CREATE_FAILED: ${body || response.status}`)
  }
}

const cancelAssetsHubBatch = async (batchRef: string, capability: string): Promise<void> => {
  await fetch(`${ASSETS_HUB_READ_ENDPOINT}/generated-batches/${batchRef}/cancel`, {
    body: JSON.stringify({ capability }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  }).catch(() => undefined)
}

const defaultDeps: TWallpaperPublishExecutorDeps = {
  cancelBatch: cancelAssetsHubBatch,
  createBatch: createAssetsHubBatch,
  exportBatch: exportWallpaperBatch,
  graphqlRequest: browserGraphQLRequest,
  hasWebGPU: () => typeof navigator !== 'undefined' && !!navigator.gpu,
  uploadImage: uploadGeneratedImage,
}

const getExportProfile = (variant: TExportedImageVariant, theme: 'light' | 'dark'): string =>
  variant.targetKey.replace(`${theme}-`, '')

const prepareWallpaperUpload = async (
  exported: TExportedImageVariant[],
  plan: Extract<TWallpaperPublishPlan, { type: 'generated' }>,
  commandId: string,
  deps: TWallpaperPublishExecutorDeps,
): Promise<TPreparedBatch> => {
  const batchResult = await deps.graphqlRequest<
    ResultOf<typeof S.prepareWallpaperUpload>,
    VariablesOf<typeof S.prepareWallpaperUpload>
  >(S.prepareWallpaperUpload, {
    community: plan.community,
    input: {
      baseVersion: plan.baseVersion,
      commandId,
      images: prepareImages(exported, plan),
      settings: plan.settings,
      theme: toGraphqlTheme(plan.theme),
    },
  })

  const batch = batchResult.prepareWallpaperUpload
  if (!batch) throw new Error('WALLPAPER_PREPARE_EMPTY_RESPONSE')
  return batch
}

const prepareImages = (
  exported: TExportedImageVariant[],
  plan: Extract<TWallpaperPublishPlan, { type: 'generated' }>,
): Array<{
  checksum: string
  height: number
  mimeType: string
  profile: WallpaperProfile
  sizeBytes: number
  width: number
}> =>
  exported.map((variant) => ({
    checksum: variant.checksum,
    height: variant.height,
    mimeType: variant.mimeType,
    profile: toGraphqlProfile(getExportProfile(variant, plan.theme)),
    sizeBytes: variant.blob.size,
    width: variant.width,
  }))

const createPublishInput = (
  plan: TWallpaperPublishPlan,
  commandId: string,
  batchRef: string | null,
) => ({
  baseVersion: plan.baseVersion,
  commandId,
  settings: plan.settings,
  theme: toGraphqlTheme(plan.theme),
  batchRef,
})

const publish = async (
  plan: TWallpaperPublishPlan,
  commandId: string,
  batchRef: string | null,
  deps: TWallpaperPublishExecutorDeps,
): Promise<ResultOf<typeof S.publishWallpaper>['publishWallpaper']> => {
  const result = await deps.graphqlRequest<
    ResultOf<typeof S.publishWallpaper>,
    VariablesOf<typeof S.publishWallpaper>
  >(S.publishWallpaper, {
    community: plan.community,
    input: createPublishInput(plan, commandId, batchRef),
  })
  return result.publishWallpaper
}

const uploadImages = async (
  exported: TExportedImageVariant[],
  batch: TPreparedBatch,
  plan: Extract<TWallpaperPublishPlan, { type: 'generated' }>,
  deps: TWallpaperPublishExecutorDeps,
): Promise<void> => {
  const intents = batch.uploadIntents as TGeneratedUploadIntent[]
  const intentByProfile = new Map(intents.map((intent) => [intent.profile.toLowerCase(), intent]))

  await Promise.all(
    exported.map((variant) => {
      const profile = getExportProfile(variant, plan.theme)
      const intent = intentByProfile.get(profile)
      if (!intent) throw new Error(`GENERATED_IMAGE_UPLOAD_INTENT_MISSING: ${profile}`)
      return deps.uploadImage({
        capability: intent.capability,
        file: variant.blob,
        uploadRef: intent.uploadRef,
      })
    }),
  )
}

/** Executes the existing prepare -> batch -> upload -> publish Wallpaper protocol. */
export const executeWallpaperPublish = async (
  plan: TWallpaperPublishPlan,
  commandId: string,
  overrides?: Partial<TWallpaperPublishExecutorDeps>,
): Promise<ResultOf<typeof S.publishWallpaper>['publishWallpaper']> => {
  const deps = { ...defaultDeps, ...overrides }

  if (plan.type === 'none') return publish(plan, commandId, null, deps)

  if (!deps.hasWebGPU()) throw new Error('WebGPU is required to publish this Wallpaper')

  const exported = await deps.exportBatch({
    targets: plan.targets,
    themes: [{ renderSpec: plan.renderSpec, theme: plan.theme }],
  })
  const batch = await prepareWallpaperUpload(exported, plan, commandId, deps)

  try {
    await deps.createBatch(batch.batchCapability)
    await uploadImages(exported, batch, plan, deps)
    return await publish(plan, commandId, batch.batchRef, deps)
  } catch (error) {
    await deps
      .cancelBatch(batch.batchRef, batch.batchCapability)
      .catch((cleanupError: unknown) =>
        console.error('## wallpaper batch cleanup error: ', cleanupError),
      )
    throw error
  }
}
