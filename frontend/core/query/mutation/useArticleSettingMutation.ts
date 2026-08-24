'use client'

import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { OperationDefinitionNode } from 'graphql'

import { browserQuery } from '~/graphql/client'

import { articleKeys, mutationKeys } from '../key'

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
    mutationFn: (variables: TVariables) => browserQuery(document, variables),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: articleKeys.all, refetchType: 'none' }),
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
