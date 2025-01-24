import gqClient from './gq_client'

export const query = (schema, variables = {}) => {
  return gqClient
    .query(schema, clearfy(variables))
    .toPromise()
    .then((res) => {
      if (res.error) throw res.error
      return res.data
    })
    .catch((e) => {
      throw e
    })
}

export const mutate = (schema, variables) => {
  return gqClient
    .mutation(schema, clearfy(variables))
    .toPromise()
    .then((res) => {
      console.log('## got res: ', res)
      if (res.error) {
        // @ts-ignore
        console.log('## error code: ', res.error.graphQLErrors[0].originalError.code)
        throw res.error
      }
      return res.data
    })
    .catch((e) => {
      throw e
    })
}

type TClearifyInput = null | TClearifyObject | TClearifyArray
type TClearifyArray = Array<TClearifyInput>
type TClearifyObject = {
  [key: string]: TClearifyInput
}
// remove __typename if need, avoid GraphQL error
const clearfy = (obj: TClearifyInput): TClearifyInput => {
  // NOTE: do not use !obj here, otherwise it will treat 0 as null
  if (obj === null) return null

  if (Array.isArray(obj)) {
    return obj.map(clearfy)
  }

  if (typeof obj === 'object') {
    const newObj: TClearifyObject = {}

    for (const key of Object.keys(obj)) {
      newObj[key] = clearfy(obj[key])
    }

    // 确保 __typename 存在再删除
    if ('__typename' in newObj) {
      delete newObj.__typename
    }
    return newObj
  }

  return obj
}
