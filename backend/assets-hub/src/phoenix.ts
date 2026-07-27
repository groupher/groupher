import { GROUPHER_SERVER_TRUST_HEADER } from '@groupher/contracts/headers'

import type { TUploadCapability } from './capability'

type TCompleteUploadInput = {
  contentHash: string
  height?: number
  idempotencyKey: string
  meta?: Record<string, unknown>
  sizeBytes: number
  storage: string
  width?: number
}

const assetTypeInput = (assetType: TUploadCapability['declaredAssetType']) =>
  assetType.toUpperCase()

const mutation = `
  mutation completeCommunityAssetUpload($input: CommunityAssetUploadCompletionInput!) {
    completeCommunityAssetUpload(input: $input) {
      id
      publicRef
      filename
      mimeType
      url
      storageKey
      contentHash
      sizeBytes
      width
      height
    }
  }
`

const requiredEnv = (environment: Record<string, string | undefined>, name: string) => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const parseGraphQLResponse = (body: string) => {
  try {
    return body ? JSON.parse(body) : null
  } catch {
    return null
  }
}

export const completePhoenixUpload = async ({
  capability,
  environment = process.env,
  input,
}: {
  capability: TUploadCapability
  environment?: Record<string, string | undefined>
  input: TCompleteUploadInput
}) => {
  const endpoint = requiredEnv(environment, 'PHOENIX_GRAPHQL_ENDPOINT')
  const trustSecret = requiredEnv(environment, 'GROUPHER_SERVER_TRUST_SECRET')

  const response = await fetch(endpoint, {
    body: JSON.stringify({
      query: mutation,
      variables: {
        input: {
          assetPublicRef: capability.assetPublicRef,
          assetType: assetTypeInput(capability.declaredAssetType),
          communityId: capability.communityId,
          contentHash: input.contentHash,
          filename: capability.declaredFilename,
          height: input.height,
          idempotencyKey: input.idempotencyKey,
          meta: JSON.stringify(input.meta ?? {}),
          mimeType: capability.declaredMimeType,
          sizeBytes: input.sizeBytes,
          storage: input.storage,
          storageKey: capability.objectKey,
          uploaderId: capability.uploaderId,
          url: capability.canonicalUrl,
          width: input.width,
        },
      },
    }),
    headers: {
      'content-type': 'application/json',
      [GROUPHER_SERVER_TRUST_HEADER]: trustSecret,
    },
    method: 'POST',
  })

  const responseText = await response.text()
  const result = parseGraphQLResponse(responseText)
  if (!response.ok || result?.errors?.length) {
    const message =
      result?.errors?.[0]?.message ||
      `Phoenix upload completion failed: ${response.status}: ${responseText}`
    throw new Error(message)
  }

  return result.data.completeCommunityAssetUpload
}
