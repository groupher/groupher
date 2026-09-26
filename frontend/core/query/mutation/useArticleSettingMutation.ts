'use client'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OperationDefinitionNode } from 'graphql'

import { browserGraphQLRequest } from '~/graphql/client'
import { invalidate, QueryInvalidation } from '~/query/invalidation'
import type { TThread } from '~/spec'

import { mutationKeys } from '../key'

const articleRef = (variables: Record<string, unknown>) => {
  const article = variables.article
  if (!article || typeof article !== 'object') return null
  const value = article as { community?: unknown; thread?: unknown; innerId?: unknown }
  if (
    typeof value.community !== 'string' ||
    typeof value.thread !== 'string' ||
    (typeof value.innerId !== 'string' && typeof value.innerId !== 'number')
  )
    return null
  return {
    community: value.community,
    thread: value.thread as TThread,
    innerId: value.innerId,
  }
}

/** Executes article-setting mutations and marks every loaded article shape stale. */
export default function useArticleSettingMutation<
  TData,
  TVariables extends Record<string, unknown>,
>(document: TypedDocumentNode<TData, TVariables>) {
  const queryClient = useQueryClient()
  const operation = document.definitions.find(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === 'OperationDefinition',
  )?.name?.value
  const mutation = useMutation({
    mutationKey: mutationKeys.article('current', `setting:${operation || 'unknown'}`),
    retry: false,
    mutationFn: (variables: TVariables) => browserGraphQLRequest(document, variables),
    onSuccess: (_data, variables) => {
      const ref = articleRef(variables as Record<string, unknown>)
      if (!ref) return
      return invalidate(queryClient, [
        QueryInvalidation.article.content(ref),
        QueryInvalidation.article.lists({ community: ref.community, thread: ref.thread }),
      ])
    },
  })

  const execute = async (variables: TVariables) => {
    try {
      const data = await mutation.mutateAsync(variables)
      return { data, error: undefined }
    } catch (error) {
      return { data: undefined, error }
    }
  }

  return [
    { data: mutation.data, error: mutation.error, fetching: mutation.isPending },
    execute,
  ] as const
}
