import type { ResultOf, TypedDocumentNode, VariablesOf } from '@graphql-typed-document-node/core'
import { queryOptions } from '@tanstack/react-query'
import { print } from 'graphql'

import { browserQuery } from '~/graphql/client'

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
) =>
  queryOptions({
    queryKey: ['graphql', print(document), variables] as const,
    queryFn: () =>
      browserQuery<[TOverride] extends [never] ? ResultOf<TDocument> : TOverride, TVariables>(
        document,
        variables,
      ),
  })
