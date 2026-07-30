import { GROUPHER_SERVER_TRUST_HEADER } from '@groupher/contracts/headers'

import type { TUploadCapability } from './capability'

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
  Record<'GROUPHER_SERVER_TRUST_SECRET' | 'PHOENIX_GRAPHQL_ENDPOINT', string>
>

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

const assetTypeInput = (assetType: TUploadCapability['declaredAssetType']) =>
  assetType.toUpperCase()

const threadInput = (thread: TUploadCapability['declaredThread']) => thread.toUpperCase()

const completeUploadMutation = `
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

const originInfoQuery = `
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
  variables,
}: {
  environment: TPhoenixEnvironment
  query: string
  variables: Record<string, unknown>
}) => {
  const endpoint = requiredEnv(environment, 'PHOENIX_GRAPHQL_ENDPOINT')
  const trustSecret = requiredEnv(environment, 'GROUPHER_SERVER_TRUST_SECRET')

  const response = await fetch(endpoint, {
    body: JSON.stringify({ query, variables }),
    headers: {
      'content-type': 'application/json',
      [GROUPHER_SERVER_TRUST_HEADER]: trustSecret,
    },
    method: 'POST',
  })

  const responseText = await response.text()
  const result = parseGraphQLResponse(responseText) as TGraphQLPayload<TData> | null

  if (!response.ok || result?.errors?.length) {
    const message =
      result?.errors?.[0]?.message || `Phoenix GraphQL failed: ${response.status}: ${responseText}`
    throw new PhoenixGraphQLError(message, response.status || 502, result?.errors ?? [])
  }

  if (!result?.data) {
    throw new PhoenixGraphQLError('Phoenix GraphQL response did not include data.', 502)
  }

  return result.data
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
  const result = await requestPhoenixGraphQL<{
    completeCommunityAssetUpload: TCompleteUploadResult
  }>({
    environment,
    query: completeUploadMutation,
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
        width: input.width,
      },
    },
  })

  return result.completeCommunityAssetUpload
}

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
    variables: { publicRef },
  })

  return result.communityAssetOriginInfo
}
