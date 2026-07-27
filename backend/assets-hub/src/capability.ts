import { createHmac, timingSafeEqual } from 'node:crypto'

export type TUploadCapability = {
  allowedMimeTypes: string[]
  assetPublicRef: string
  canonicalUrl: string
  checksumSha256?: string | null
  communityId: number
  communitySlug: string
  declaredAssetType: 'audio' | 'file' | 'image' | 'video'
  declaredFilename: string
  declaredMimeType: string
  declaredSizeBytes: number
  expiresAt: string
  maxSizeBytes: number
  objectKey: string
  purpose: 'asset.upload'
  uploadRef: string
  uploaderId?: number | null
}

const requiredSecret = (environment: Record<string, string | undefined>) => {
  const secret =
    environment.ASSETS_HUB_CAPABILITY_SECRET?.trim() ||
    environment.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!secret) throw new Error('ASSETS_HUB_CAPABILITY_SECRET is required')
  return secret
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

const assertCapability = (value: unknown): TUploadCapability => {
  const capability = value as TUploadCapability

  if (capability?.purpose !== 'asset.upload') throw new Error('Invalid capability purpose')
  if (!capability.uploadRef || !capability.assetPublicRef || !capability.objectKey) {
    throw new Error('Invalid upload capability')
  }
  if (!capability.allowedMimeTypes.includes(capability.declaredMimeType)) {
    throw new Error('Capability MIME type is not allowed')
  }
  if (capability.declaredSizeBytes <= 0 || capability.declaredSizeBytes > capability.maxSizeBytes) {
    throw new Error('Capability file size is not allowed')
  }
  if (Date.parse(capability.expiresAt) <= Date.now()) throw new Error('Capability expired')

  return capability
}

export const verifyCapability = (
  token: string,
  environment: Record<string, string | undefined> = process.env,
) => {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) throw new Error('Invalid capability token')

  const expected = sign(payload, requiredSecret(environment))
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('Invalid capability signature')
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  return assertCapability(decoded)
}
