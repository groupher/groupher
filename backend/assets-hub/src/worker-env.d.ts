type R2ObjectBody = {
  body: ReadableStream
  httpEtag?: string
  httpMetadata?: {
    contentType?: string
  }
  size?: number
}

type R2Bucket = {
  delete(key: string): Promise<void>
  get(key: string): Promise<R2ObjectBody | null>
}

type Queue<Body = unknown> = {
  send(body: Body): Promise<void>
}

type Message<Body = unknown> = {
  body: Body
}

type MessageBatch<Body = unknown> = {
  messages: Message<Body>[]
}

interface Env {
  ASSET_DELETE_QUEUE: Queue
  ASSETS_BUCKET: R2Bucket
  ASSETS_PUBLIC_ENDPOINT?: string
  ENVIRONMENT?: string
  GROUPHER_SERVER_TRUST_SECRET?: string
  PHOENIX_GRAPHQL_ENDPOINT?: string
  VERSION?: string
}
