import { createHmac, timingSafeEqual } from 'node:crypto'

export type TUploadCapability = {
  /** Server-side MIME allowlist copied from Phoenix policy, for example ["image/png"]. */
  allowedMimeTypes: string[]
  /** Stable public asset id used in URLs, for example "asset_xxx". */
  assetPublicRef: string
  /** Public original URL that Phoenix will persist after finalize. */
  canonicalUrl: string
  /** Optional browser-computed SHA-256 digest in base64, checked against R2 metadata when present. */
  checksumSha256?: string | null
  /** Phoenix community id that scopes the final DB write. */
  communityId: number
  /** Community slug used to derive the R2 key prefix, for example "groupher". */
  communitySlug: string
  /** File category inferred from the declared MIME type. */
  declaredAssetType: 'audio' | 'file' | 'image' | 'video'
  /** Browser-supplied filename validated by Phoenix before signing. */
  declaredFilename: string
  /** Browser-supplied MIME type validated by Phoenix and rechecked against R2 HeadObject. */
  declaredMimeType: string
  /** Browser-supplied byte size validated by Phoenix and rechecked against R2 HeadObject. */
  declaredSizeBytes: number
  /** Article thread that owns the asset in the community library. */
  declaredThread: 'blog' | 'changelog' | 'doc' | 'post'
  /** ISO timestamp after which assets-hub rejects the capability. */
  expiresAt: string
  /** Phoenix policy cap for this upload intent. */
  maxSizeBytes: number
  /** R2 object key for the original, for example "communities/groupher/assets/2026_07/29_xxx/original". */
  objectKey: string
  /** Capability purpose guard so the token cannot be reused for another action. */
  purpose: 'asset.upload'
  /** Short-lived upload transaction id, for example "upload_xxx". */
  uploadRef: string
  /** Optional uploader id persisted by Phoenix after assets-hub verifies the object. */
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
