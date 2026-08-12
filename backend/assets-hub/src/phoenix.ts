import {
  createServiceTokenProviderFromEnv,
  type TServiceTokenProvider,
} from '@groupher/service/auth'

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
    | 'SERVICE_AUTH_CLIENT_ID'
    | 'SERVICE_AUTH_CLIENT_SECRET'
    | 'SERVICE_AUTH_TOKEN_ENDPOINT',
    string
  >
>

let serviceTokenProvider: TServiceTokenProvider | undefined

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
  serviceTokenProvider ??= createServiceTokenProviderFromEnv(environment)
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
    scope: 'assets:origin:read',
    variables: { publicRef },
  })

  return result.communityAssetOriginInfo
}

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
