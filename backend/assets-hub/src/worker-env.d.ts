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
  PHOENIX_GRAPHQL_ENDPOINT?: string
  SERVICE_AUTH_CLIENT_ID?: string
  SERVICE_AUTH_CLIENT_SECRET?: string
  SERVICE_AUTH_ISSUER?: string
  SERVICE_AUTH_JWKS_URL?: string
  SERVICE_AUTH_TOKEN_ENDPOINT?: string
  VERSION?: string
}
