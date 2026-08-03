import { proxyGraphQLRequest } from '~/graphql/proxy'

export const dynamic = 'force-dynamic'

export const GET = (request: Request) => proxyGraphQLRequest(request)
export const POST = (request: Request) => proxyGraphQLRequest(request)
