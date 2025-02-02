import { useQuery as useGQQuery } from 'urql'

const useQuery = (query, variables) => {
  const [result, reexecuteQuery] = useGQQuery({
    query,
    variables,
    // requestPolicy: 'cache-and-network',
  })

  const reload = (variables) => {
    reexecuteQuery({ requestPolicy: 'network-only', variables })
  }

  const { data, error } = result

  return { data, error, reload }
}

export default useQuery
