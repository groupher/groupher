'use client'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OperationDefinitionNode } from 'graphql'

import { browserGraphQLRequest } from '~/graphql/client'
import { invalidate, QueryInvalidation } from '~/query/invalidation'

import { isArticleThread, type TArticlePath } from '../articlePath'
import { mutationKeys } from '../key'

const articlePath = (variables: Record<string, unknown>): TArticlePath | null => {
  const article = variables.article
  if (!article || typeof article !== 'object') return null
  const value = article as { community?: unknown; thread?: unknown; innerId?: unknown }
  if (
    typeof value.community !== 'string' ||
    typeof value.thread !== 'string' ||
    !isArticleThread(value.thread) ||
    (typeof value.innerId !== 'string' && typeof value.innerId !== 'number')
  )
    return null
  return {
    community: value.community,
    thread: value.thread,
    innerId: String(value.innerId),
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
      const path = articlePath(variables as Record<string, unknown>)
      if (!path) return
      return invalidate(queryClient, [
        QueryInvalidation.article.content(path),
        QueryInvalidation.article.lists({ community: path.community, thread: path.thread }),
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
