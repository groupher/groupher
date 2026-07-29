type R2ObjectBody = {
  body: ReadableStream
  httpEtag?: string
  httpMetadata?: {
    contentType?: string
  }
  size?: number
}

type R2Bucket = {
  get(key: string): Promise<R2ObjectBody | null>
}

interface Env {
  ASSETS_BUCKET: R2Bucket
  ASSETS_PUBLIC_ENDPOINT?: string
  GROUPHER_SERVER_TRUST_SECRET?: string
  PHOENIX_GRAPHQL_ENDPOINT?: string
}
