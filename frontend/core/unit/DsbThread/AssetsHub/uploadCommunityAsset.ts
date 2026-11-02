import type { ResultOf, VariablesOf } from '@graphql-typed-document-node/core'

import { ASSETS_HUB_ENDPOINT } from '~/config'
import { browserGraphQLRequest } from '~/graphql/client'
import type { AssetThread } from '~/lib/graphql/generated/graphql'
import S from '~/unit/DsbThread/schema/assets'

import {
  assetTypeFromMime,
  checksumSha256,
  extractErrorMessage,
  putFileWithProgress,
} from './helper'
import type { TFinalizeResult, THubUploadResult, TUploadProgress } from './spec'

type TCreateAssetUploadIntent = ResultOf<typeof S.createCommunityAssetUploadIntent>
type TCreateAssetUploadVariables = VariablesOf<typeof S.createCommunityAssetUploadIntent>

export type TCommunityAssetUploadStage = 'checksum' | 'intent' | 'presign' | 'put' | 'finalize'
export type TCommunityAssetUploadStageState = 'done' | 'running'

export type TCommunityAssetUploadOptions = {
  community: string
  file: File
  onProgress?: (progress: TUploadProgress) => void
  onStage?: (
    stage: TCommunityAssetUploadStage,
    state: TCommunityAssetUploadStageState,
    duration?: number,
  ) => void
  thread?: AssetThread
}

export type TCommunityAssetUploadResult = {
  assetPublicRef: string
  timings: Array<{ duration: number; label: string }>
  uploadRef: string
}

/** Reports which upload phase failed so callers can show an actionable diagnostic. */
export class CommunityAssetUploadError extends Error {
  readonly causeError: unknown
  readonly stage: TCommunityAssetUploadStage

  constructor(stage: TCommunityAssetUploadStage, error: unknown) {
    super(`ASSETS_HUB_UPLOAD_${stage.toUpperCase()}_FAILED: ${extractErrorMessage(error)}`)
    this.name = 'CommunityAssetUploadError'
    this.causeError = error
    this.stage = stage
  }
}

const runStage = async <T>(
  stage: TCommunityAssetUploadStage,
  task: () => Promise<T>,
  onStage?: TCommunityAssetUploadOptions['onStage'],
): Promise<T> => {
  onStage?.(stage, 'running')
  const startedAt = performance.now()

  try {
    return await task()
  } catch (error) {
    throw new CommunityAssetUploadError(stage, error)
  } finally {
    onStage?.(stage, 'done', performance.now() - startedAt)
  }
}

/** Uploads a browser File through the existing intent, presign, R2 PUT, and finalize protocol. */
export const uploadCommunityAsset = async ({
  community,
  file,
  onProgress,
  onStage,
  thread,
}: TCommunityAssetUploadOptions): Promise<TCommunityAssetUploadResult> => {
  const digest = await runStage('checksum', () => checksumSha256(file), onStage)
  const fileInput: TCreateAssetUploadVariables['file'] = {
    assetType: assetTypeFromMime(file.type),
    checksumSha256: digest,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    ...(thread ? { thread } : {}),
  }
  const intent = await runStage(
    'intent',
    () =>
      browserGraphQLRequest<TCreateAssetUploadIntent, TCreateAssetUploadVariables>(
        S.createCommunityAssetUploadIntent,
        { community, file: fileInput },
      ),
    onStage,
  )
  const uploadIntent = intent.createCommunityAssetUploadIntent
  if (!uploadIntent) throw new Error('Asset upload intent was not created')
  const { capability, uploadRef, assetPublicRef } = uploadIntent
  const presignJson = await runStage(
    'presign',
    async () => {
      const response = await fetch(`${ASSETS_HUB_ENDPOINT}/uploads`, {
        body: JSON.stringify({ capability }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as THubUploadResult

      if (!response.ok) throw new Error(JSON.stringify(payload))

      return payload
    },
    onStage,
  )

  await runStage(
    'put',
    () =>
      putFileWithProgress({
        file,
        headers: presignJson.result.upload.headers,
        method: presignJson.result.upload.method,
        onProgress: onProgress ?? (() => undefined),
        url: presignJson.result.upload.url,
      }),
    onStage,
  )

  const finalizeJson = await runStage(
    'finalize',
    async () => {
      const response = await fetch(`${ASSETS_HUB_ENDPOINT}/uploads/${uploadRef}/finalize`, {
        body: JSON.stringify({ capability }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const payload = (await response.json()) as TFinalizeResult

      if (!response.ok) throw new Error(JSON.stringify(payload))

      return payload
    },
    onStage,
  )

  return {
    assetPublicRef,
    timings: finalizeJson.result?.timings ?? [],
    uploadRef,
  }
}
