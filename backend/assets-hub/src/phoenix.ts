/**
 * Implements the Src Phoenix boundary inside Assets Hub.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import type { TGeneratedImageManifestEntry } from '@groupher/contracts/wallpaper'
import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

import type { TGeneratedImageUploadCapability } from './capability'
import type { TCommunityAssetUploadCapability, TUploadCapability } from './capability'

export type TCommunityAssetOriginInfo = {
  deletedAt: string | null
  filename: string | null
  height: number | null
  meta: unknown
  mimeType: string | null
  publicRef: string
  sizeBytes: number | string | null
  status: 'ACTIVE' | 'DELETED'
  storage: string | null
  storageKey: string | null
  width: number | null
}

type TCompleteUploadResult = {
  contentHash: string
  filename: string | null
  height: number | null
  id: string
  mimeType: string | null
  publicRef: string
  sizeBytes: number | string | null
  storageKey: string
  url: string
  width: number | null
}

type TCompleteApplicationLogoResult = {
  finalizedAt: string
  status: string
  uploadRef: string
  url: string
}

type TCompleteUploadInput = {
  contentHash: string
  height?: number
  idempotencyKey: string
  meta?: Record<string, unknown>
  sizeBytes: number
  storage: string
  width?: number
}

type TPhoenixEnvironment = Partial<
  Record<
    | 'PHOENIX_GRAPHQL_ENDPOINT'
    | 'ASSETS_HUB_BATCH_ENDPOINT'
    | 'SERVICE_AUTH_CLIENT_ID'
    | 'SERVICE_AUTH_CLIENT_SECRET'
    | 'SERVICE_AUTH_TOKEN_ENDPOINT',
    string
  >
>

let serviceTokenProvider: TServiceAuthClient | undefined

type TGraphQLError = {
  extensions?: Record<string, unknown>
  message?: string
}

type TGraphQLPayload<TData> = {
  data?: TData
  errors?: TGraphQLError[]
}

export class PhoenixGraphQLError extends Error {
  errors: TGraphQLError[]
  status: number

  constructor(message: string, status: number, errors: TGraphQLError[] = []) {
    super(message)
    this.name = 'PhoenixGraphQLError'
    this.status = status
    this.errors = errors
  }
}

const assetTypeInput = (assetType: TCommunityAssetUploadCapability['declaredAssetType']) =>
  assetType.toUpperCase()

const threadInput = (thread: TCommunityAssetUploadCapability['declaredThread']) =>
  thread.toUpperCase()

const completeUploadMutation = `
  "Complete a verified assets-hub upload"
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

const completeApplicationLogoMutation = `
  "Complete an Application Logo upload from Assets Hub"
  mutation completeCommunityApplicationLogoUpload(
    $input: CommunityApplicationLogoCompletionInput!
  ) {
    completeCommunityApplicationLogoUpload(input: $input) {
      uploadRef
      status
      url
      finalizedAt
    }
  }
`

const originInfoQuery = `
  "Service-scoped public-read origin metadata for one community asset"
  query communityAssetOriginInfo($publicRef: String!) {
    communityAssetOriginInfo(publicRef: $publicRef) {
      publicRef
      status
      deletedAt
      filename
      storage
      storageKey
      mimeType
      sizeBytes
      width
      height
      meta
    }
  }
`

const applicationLogoOriginInfoQuery = `
  "Server-trusted origin metadata for an Application Logo"
  query communityApplicationLogoOriginInfo($publicRef: ID!) {
    communityApplicationLogoOriginInfo(publicRef: $publicRef) {
      publicRef
      filename
      storage
      storageKey
      mimeType
      sizeBytes
    }
  }
`

const requiredEnv = (environment: TPhoenixEnvironment, name: keyof TPhoenixEnvironment) => {
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

const requestPhoenixGraphQL = async <TData>({
  environment,
  query,
  scope,
  variables,
}: {
  environment: TPhoenixEnvironment
  query: string
  scope: string
  variables: Record<string, unknown>
}) => {
  const endpoint = requiredEnv(environment, 'PHOENIX_GRAPHQL_ENDPOINT')
  serviceTokenProvider ??= createServiceAuthClientFromEnv(environment)
  const serviceToken = await serviceTokenProvider.getToken({
    resource: 'https://api.groupher.com/assets',
    scopes: [scope],
  })

  const response = await fetch(endpoint, {
    body: JSON.stringify({ query, variables }),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceToken}`,
    },
    method: 'POST',
  })

  if (!response.ok) {
    const responseText = await response.text()
    const result = parseGraphQLResponse(responseText) as TGraphQLPayload<TData> | null
    const message =
      result?.errors?.[0]?.message || `Phoenix GraphQL failed: ${response.status}: ${responseText}`
    throw new PhoenixGraphQLError(message, response.status || 502, result?.errors ?? [])
  }

  const responseText = await response.text()
  const result = parseGraphQLResponse(responseText) as TGraphQLPayload<TData> | null

  if (result?.errors?.length) {
    throw new PhoenixGraphQLError(
      result.errors[0]?.message || 'Phoenix GraphQL returned an error.',
      response.status || 502,
      result.errors,
    )
  }

  if (!result?.data) {
    throw new PhoenixGraphQLError('Phoenix GraphQL response did not include data.', 502)
  }

  return result.data
}

/** Runs the complete phoenix upload operation at the assets hub boundary. */
export const completePhoenixUpload = async ({
  capability,
  environment = process.env,
  input,
}: {
  capability: TUploadCapability
  environment?: Record<string, string | undefined>
  input: TCompleteUploadInput
}) => {
  if (capability.purpose === 'community_application_logo') {
    const result = await requestPhoenixGraphQL<{
      completeCommunityApplicationLogoUpload: TCompleteApplicationLogoResult
    }>({
      environment,
      query: completeApplicationLogoMutation,
      scope: 'assets:application-upload:complete',
      variables: {
        input: {
          contentHash: input.contentHash,
          mimeType: capability.declaredMimeType,
          sizeBytes: input.sizeBytes,
          storage: input.storage,
          storageKey: capability.objectKey,
          uploadRef: capability.uploadRef,
          url: capability.canonicalUrl,
        },
      },
    })

    return result.completeCommunityApplicationLogoUpload
  }

  const result = await requestPhoenixGraphQL<{
    completeCommunityAssetUpload: TCompleteUploadResult
  }>({
    environment,
    query: completeUploadMutation,
    scope: 'assets:upload:complete',
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
        thread: threadInput(capability.declaredThread),
        uploaderId: capability.uploaderId,
        url: capability.canonicalUrl,
        uploadRef: capability.uploadRef,
        width: input.width,
      },
    },
  })

  return result.completeCommunityAssetUpload
}

/** Records a generated asset in its persistent batch before Phoenix completion. */
export const registerGeneratedAsset = async ({
  capability,
  capabilityToken,
  environment = process.env,
  entry,
}: {
  capability: TGeneratedImageUploadCapability
  capabilityToken: string
  environment?: Record<string, string | undefined>
  entry: Pick<TGeneratedImageManifestEntry, 'checksum' | 'storageKey'>
}) => {
  const endpoint = environment.ASSETS_HUB_BATCH_ENDPOINT?.trim()
  if (!endpoint) throw new Error('ASSETS_HUB_BATCH_ENDPOINT is required')

  serviceTokenProvider ??= createServiceAuthClientFromEnv(environment)
  const serviceToken = await serviceTokenProvider.getToken({
    resource: 'https://assets.groupher.com/internal',
    scopes: ['assets:generated-batch:register'],
  })

  const response = await fetch(
    `${endpoint.replace(/\/$/, '')}/generated-batches/${capability.batchRef}/assets`,
    {
      body: JSON.stringify({
        assetPublicRef: capability.assetPublicRef,
        candidateOwnerRef: capability.candidateOwnerRef,
        capability: capabilityToken,
        checksum: entry.checksum,
        storageKey: entry.storageKey,
      }),
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  )

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new Error(
      payload?.error?.message || `Assets Hub batch registration failed: ${response.status}`,
    )
  }
  return (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
}

/** Runs the fetch community asset origin info operation at the assets hub boundary. */
export const fetchCommunityAssetOriginInfo = async ({
  environment,
  publicRef,
}: {
  environment: TPhoenixEnvironment
  publicRef: string
}) => {
  const result = await requestPhoenixGraphQL<{
    communityAssetOriginInfo: TCommunityAssetOriginInfo | null
  }>({
    environment,
    query: originInfoQuery,
    scope: 'assets:origin:read',
    variables: { publicRef },
  })

  return result.communityAssetOriginInfo
}

/** Runs the fetch asset origin info operation at the assets hub boundary. */
export const fetchAssetOriginInfo = async ({
  environment,
  publicRef,
}: {
  environment: TPhoenixEnvironment
  publicRef: string
}): Promise<TCommunityAssetOriginInfo | null> => {
  if (!publicRef.startsWith('app_logo_')) {
    return fetchCommunityAssetOriginInfo({ environment, publicRef })
  }

  const result = await requestPhoenixGraphQL<{
    communityApplicationLogoOriginInfo: Omit<
      TCommunityAssetOriginInfo,
      'deletedAt' | 'height' | 'meta' | 'status' | 'width'
    > | null
  }>({
    environment,
    query: applicationLogoOriginInfoQuery,
    scope: 'assets:origin:read',
    variables: { publicRef },
  })

  const upload = result.communityApplicationLogoOriginInfo
  if (!upload) return null

  return {
    ...upload,
    deletedAt: null,
    height: null,
    meta: null,
    status: 'ACTIVE',
    width: null,
  }
}
