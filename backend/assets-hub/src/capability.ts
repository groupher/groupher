/**
 * Implements the Src Capability boundary inside Assets Hub.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

import type { TGeneratedImageUploadBatchTarget } from '@groupher/contracts/wallpaper'

type TBaseUploadCapability = {
  /** Server-side MIME allowlist copied from Phoenix policy, for example ["image/png"]. */
  allowedMimeTypes: string[]
  /** Public original URL that Phoenix will persist after finalize. */
  canonicalUrl: string
  /** Optional browser-computed SHA-256 digest in base64, checked against R2 metadata when present. */
  checksumSha256?: string | null
  /** Browser-supplied filename validated by Phoenix before signing. */
  declaredFilename: string
  /** Browser-supplied MIME type validated by Phoenix and rechecked against R2 HeadObject. */
  declaredMimeType: string
  /** Browser-supplied byte size validated by Phoenix and rechecked against R2 HeadObject. */
  declaredSizeBytes: number
  /** ISO timestamp after which assets-hub rejects the capability. */
  expiresAt: string
  /** Phoenix policy cap for this upload intent. */
  maxSizeBytes: number
  /** R2 object key for the original, for example "communities/groupher/assets/2026_07/29_xxx/original". */
  objectKey: string
  /** Short-lived upload transaction id, for example "upload_xxx". */
  uploadRef: string
  /** Optional uploader id persisted by Phoenix after assets-hub verifies the object. */
  uploaderId?: number | null
}

export type TCommunityAssetUploadCapability = TBaseUploadCapability & {
  assetPublicRef: string
  communityId: number
  communitySlug: string
  declaredAssetType: 'audio' | 'file' | 'image' | 'video'
  declaredThread: 'blog' | 'changelog' | 'doc' | 'post'
  purpose: 'asset.upload'
}

export type TGeneratedImageUploadCapability = TBaseUploadCapability & {
  assetPublicRef: string
  batchRef: string
  candidateOwnerRef: string
  communityId: number
  communitySlug: string
  declaredAssetType: 'image'
  declaredHeight: number
  declaredThread: 'post'
  declaredWidth: number
  purpose: 'generated_image'
  variantKey: string
}

export type TApplicationLogoUploadCapability = TBaseUploadCapability & {
  purpose: 'community_application_logo'
}

export type TUploadCapability =
  | TApplicationLogoUploadCapability
  | TCommunityAssetUploadCapability
  | TGeneratedImageUploadCapability

export type TGeneratedImageBatchCapability = {
  capabilityPurpose: 'generated_image_batch'
  batchRef: string
  expectedVariants: TGeneratedImageUploadBatchTarget[]
  expiresAt: string
  purpose: string
  requestDigest: string
  requestDigestVersion: number
}

type TCapabilityEnvironment = {
  ASSETS_HUB_CAPABILITY_SECRET?: string
}

const requiredSecret = (environment: TCapabilityEnvironment) => {
  const secret = environment.ASSETS_HUB_CAPABILITY_SECRET?.trim()
  if (!secret) throw new Error('ASSETS_HUB_CAPABILITY_SECRET is required')
  return secret
}

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

/** Signs a Phoenix-issued capability payload for Assets Hub verification. */
export const signPayload = (
  value: Record<string, unknown>,
  environment: TCapabilityEnvironment = process.env,
) => {
  const encoded = Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encoded}.${sign(encoded, requiredSecret(environment))}`
}

const assertCapability = (value: unknown): TUploadCapability => {
  const capability = value as TUploadCapability

  if (
    !['asset.upload', 'community_application_logo', 'generated_image'].includes(capability?.purpose)
  ) {
    throw new Error('Invalid capability purpose')
  }
  if (!capability.uploadRef || !capability.objectKey || !capability.canonicalUrl) {
    throw new Error('Invalid upload capability')
  }
  if (
    capability.purpose !== 'community_application_logo' &&
    (!capability.assetPublicRef || !capability.communityId || !capability.communitySlug)
  ) {
    throw new Error('Invalid community asset upload capability')
  }
  if (!capability.allowedMimeTypes.includes(capability.declaredMimeType)) {
    throw new Error('Capability MIME type is not allowed')
  }
  if (capability.declaredSizeBytes <= 0 || capability.declaredSizeBytes > capability.maxSizeBytes) {
    throw new Error('Capability file size is not allowed')
  }
  if (Date.parse(capability.expiresAt) <= Date.now()) throw new Error('Capability expired')

  if (capability.purpose === 'generated_image') {
    if (
      !capability.batchRef ||
      !capability.candidateOwnerRef ||
      !capability.variantKey ||
      capability.declaredAssetType !== 'image' ||
      capability.declaredThread !== 'post' ||
      !Number.isInteger(capability.declaredWidth) ||
      !Number.isInteger(capability.declaredHeight)
    ) {
      throw new Error('Invalid generated image upload capability')
    }
  }

  return capability
}

/** Runs the verify capability operation at the assets hub boundary. */
export const verifyCapability = (
  token: string,
  environment: TCapabilityEnvironment = process.env,
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

const assertBatchCapability = (value: unknown): TGeneratedImageBatchCapability => {
  const capability = value as TGeneratedImageBatchCapability
  if (
    capability?.capabilityPurpose !== 'generated_image_batch' ||
    !capability.purpose ||
    !capability.batchRef ||
    !capability.requestDigest ||
    !Number.isInteger(capability.requestDigestVersion) ||
    !Array.isArray(capability.expectedVariants) ||
    Date.parse(capability.expiresAt) <= Date.now()
  ) {
    throw new Error('Invalid generated image batch capability')
  }
  return capability
}

/** Verifies the Phoenix-signed capability used to create a generated-image batch. */
export const verifyBatchCapability = (
  token: string,
  environment: TCapabilityEnvironment = process.env,
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

  return assertBatchCapability(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
}

/** Verifies a publish claim token before allowing Phoenix to clean up an orphan. */
export const verifyPublishClaim = (
  token: string,
  environment: TCapabilityEnvironment = process.env,
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

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    batchRef?: string
    claimKey?: string
    expiresAt?: string
    purpose?: string
  }
  if (
    decoded.purpose !== 'generated_image_publish' ||
    !decoded.batchRef ||
    !decoded.claimKey ||
    !decoded.expiresAt ||
    Date.parse(decoded.expiresAt) <= Date.now()
  ) {
    throw new Error('Invalid generated image publish claim')
  }
  return decoded
}
