import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { print, type DocumentNode } from 'graphql'
import { headers } from 'next/headers'

import { GRAPHQL_ENDPOINT } from '~/config'

const schemaToString = (schema: string | DocumentNode): string => {
  if (typeof schema === 'string') return schema

  return print(schema)
}

const readCookie = (headerStore: Headers, name: string): string | null => {
  const cookieHeader = headerStore.get('cookie')
  if (!cookieHeader) return null

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=')
    if (rawName === name) return rawValue.join('=')
  }

  return null
}

const requestHeaders = (authToken?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(authToken ? { cookie: `${GROUPHER_AUTH_TOKEN_COOKIE}=${authToken}` } : {}),
})

const postGraphQL = async (
  query: string | DocumentNode,
  variables?: Record<string, unknown>,
  authToken?: string | null,
): Promise<Response> => {
  return await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: requestHeaders(authToken),
    body: JSON.stringify({
      query: schemaToString(query),
      variables,
    }),
  })
}

export type TGraphQLPayload<TData> = {
  data?: TData
  errors?: Array<{ message?: string }>
}

/**
 * Sends a server-side GraphQL POST to Phoenix.
 *
 * This default variant is anonymous and never reads request headers or cookies,
 * so it is safe for public SSR data and `"use cache"` scopes.
 *
 * @example
 * ```ts
 * const response = await gqFetch(communityQuery, {
 *   slug: 'home',
 *   userHasLogin: false,
 * })
 * const payload = await response.json()
 * ```
 */
export const gqFetch = async (
  query: string | DocumentNode,
  variables?: Record<string, unknown>,
): Promise<Response> => {
  return postGraphQL(query, variables)
}

/**
 * Typed SSR boundary for migrated operations.
 *
 * The transport still returns the raw GraphQL envelope, but the document
 * controls both the variables accepted at the call site and the result type
 * carried by `data`. Legacy string queries continue to use `gqFetch`.
 */
export const gqFetchTyped = async <TResult, TVariables extends Record<string, unknown>>(
  query: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
): Promise<TGraphQLPayload<TResult>> => {
  const response = await gqFetch(query, variables)

  return (await response.json()) as TGraphQLPayload<TResult>
}

/**
 * Typed request-aware SSR boundary for migrated operations.
 *
 * Like `gqFetchTyped`, this keeps variables and results tied to the document
 * while preserving the existing request-cookie behavior of `gqAuthFetch`.
 * Callers must keep it outside `"use cache"` scopes.
 */
export const gqAuthFetchTyped = async <TResult, TVariables extends Record<string, unknown>>(
  query: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
): Promise<TGraphQLPayload<TResult>> => {
  const response = await gqAuthFetch(query, variables)

  return (await response.json()) as TGraphQLPayload<TResult>
}

/**
 * Sends a request-aware server-side GraphQL POST to Phoenix.
 *
 * User-specific SSR calls use the current request cookies when available and
 * forward only the canonical Groupher auth token cookie to Phoenix. Do not call
 * this from `"use cache"` scopes.
 */
export const gqAuthFetch = async (
  query: string | DocumentNode,
  variables?: Record<string, unknown>,
): Promise<Response> => {
  const headerStore = await headers()
  const token = readCookie(headerStore, GROUPHER_AUTH_TOKEN_COOKIE)

  return postGraphQL(query, variables, token)
}

/** Canonical anonymous public GraphQL transport. */
export const publicQuery = gqFetchTyped

/** Canonical request-aware authenticated GraphQL transport. */
export const authQuery = gqAuthFetchTyped
