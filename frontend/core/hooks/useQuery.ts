import { useQuery as useGQQuery } from 'urql'

const useQuery = (query, variables) => {
  const [result, reexecuteQuery] = useGQQuery({
    query,
    variables,
  })

  const reload = (nextVariables?: any) => {
    reexecuteQuery({
      requestPolicy: 'network-only',
      variables: nextVariables ?? variables,
    })
  }

  const { data, error, fetching } = result

  return { data, error, loading: fetching, reload }
}

export default useQuery
