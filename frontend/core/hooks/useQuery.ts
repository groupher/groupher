import type { AnyVariables, DocumentInput } from '@urql/core'
import { useQuery as useGQQuery } from 'urql'

const useQuery = <TData = unknown, TVariables extends AnyVariables = AnyVariables>(
  query: DocumentInput<TData, TVariables>,
  variables: TVariables,
) => {
  const [result, reexecuteQuery] = useGQQuery<TData, TVariables>({
    query,
    variables,
  })

  const reload = (nextVariables?: TVariables) => {
    reexecuteQuery({
      requestPolicy: 'network-only',
      variables: nextVariables ?? variables,
    })
  }

  const { data, error, fetching } = result

  return { data, error, loading: fetching, reload }
}

export default useQuery
