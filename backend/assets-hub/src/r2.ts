/**
 * Implements the Src R2 boundary inside Assets Hub.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import { randomUUID } from 'node:crypto'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type TR2Config = {
  accessKeyId: string
  bucket: string
  endpoint: string
  region: string
  secretAccessKey: string
}

export type TR2SmokeResult = {
  bucket: string
  contentLength: number
  contentType: string
  etag?: string
  key: string
}

const requiredEnv = (environment: Record<string, string | undefined>, name: string): string => {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

/** Returns r2 config for the assets hub workflow. */
export const getR2Config = (environment: Record<string, string | undefined> = process.env) => {
  const endpoint = requiredEnv(environment, 'ASSETS_R2_ENDPOINT')
  if (endpoint.includes(requiredEnv(environment, 'ASSETS_R2_BUCKET'))) {
    throw new Error('ASSETS_R2_ENDPOINT must be the account endpoint, not a bucket URL')
  }

  return {
    accessKeyId: requiredEnv(environment, 'ASSETS_R2_ACCESS_KEY_ID'),
    bucket: requiredEnv(environment, 'ASSETS_R2_BUCKET'),
    endpoint,
    region: environment.ASSETS_R2_REGION?.trim() || 'auto',
    secretAccessKey: requiredEnv(environment, 'ASSETS_R2_SECRET_ACCESS_KEY'),
  } satisfies TR2Config
}

/** Creates r2 client from typed assets hub inputs. */
export const createR2Client = (config = getR2Config()) =>
  new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: true,
    region: config.region,
  })

const assertHeadObject = (
  head: HeadObjectCommandOutput,
): Required<Pick<TR2SmokeResult, 'contentLength' | 'contentType'>> => {
  const contentLength = head.ContentLength
  if (typeof contentLength !== 'number') {
    throw new Error('R2 HeadObject did not return ContentLength')
  }

  return {
    contentLength,
    contentType: head.ContentType || 'application/octet-stream',
  }
}

/** Creates presigned put url from typed assets hub inputs. */
export const createPresignedPutUrl = async ({
  checksumSha256,
  contentType,
  expiresInSeconds = 300,
  key,
}: {
  checksumSha256?: string | null
  contentType: string
  expiresInSeconds?: number
  key: string
}): Promise<string> => {
  const config = getR2Config()
  const client = createR2Client(config)

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      ChecksumSHA256: checksumSha256 || undefined,
      ContentType: contentType,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  )
}

/** Creates presigned get url from typed assets hub inputs. */
export const createPresignedGetUrl = async ({
  expiresInSeconds = 300,
  key,
}: {
  expiresInSeconds?: number
  key: string
}): Promise<string> => {
  const config = getR2Config()
  const client = createR2Client(config)

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn: expiresInSeconds },
  )
}

/** Runs the head r2 object operation at the assets hub boundary. */
export const headR2Object = async (key: string) => {
  const config = getR2Config()
  const client = createR2Client(config)

  return client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }))
}

/** Returns r2 object bytes for the assets hub workflow. */
export const getR2ObjectBytes = async (key: string) => {
  const config = getR2Config()
  const client = createR2Client(config)
  const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))

  if (!object.Body) throw new Error('R2 GetObject did not return a body')

  const bytes = await object.Body.transformToByteArray()
  return Buffer.from(bytes)
}

/** Runs the smoke r2 operation at the assets hub boundary. */
export const smokeR2 = async (): Promise<TR2SmokeResult> => {
  const config = getR2Config()
  const client = createR2Client(config)
  const key = `dev-smoke/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`
  const body = `groupher assets-hub r2 smoke ${new Date().toISOString()}\n`
  const contentType = 'text/plain; charset=utf-8'

  await client.send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucket,
      ContentType: contentType,
      Key: key,
    }),
  )

  const head = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }))
  const { contentLength, contentType: resolvedContentType } = assertHeadObject(head)

  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))

  return {
    bucket: config.bucket,
    contentLength,
    contentType: resolvedContentType,
    etag: head.ETag,
    key,
  }
}
