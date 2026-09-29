import type { ResultOf, TypedDocumentNode, VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'
import { print } from 'graphql'

import { browserGraphQLRequest } from '~/graphql/client'

export const graphqlKeys = {
  all: ['graphql'] as const,
  document: (document: string, variables: Record<string, unknown>) =>
    [...graphqlKeys.all, document, variables] as const,
}

/** Builds TanStack options for a page-local typed GraphQL read without legacy request-policy semantics. */
export const graphqlQueryOptions = <
  TOverride = never,
  TDocument extends TypedDocumentNode<unknown, Record<string, unknown>> = TypedDocumentNode<
    unknown,
    Record<string, unknown>
  >,
  TVariables extends Record<string, unknown> = VariablesOf<TDocument>,
>(
  document: TDocument,
  variables: TVariables,
  options?: { queryKey?: readonly unknown[] },
) =>
  queryOptions({
    queryKey: options?.queryKey || graphqlKeys.document(print(document), variables),
    queryFn: () =>
      browserGraphQLRequest<
        [TOverride] extends [never] ? ResultOf<TDocument> : TOverride,
        TVariables
      >(document, variables),
  })
