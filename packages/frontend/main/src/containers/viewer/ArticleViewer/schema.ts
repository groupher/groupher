import { gql } from 'urql'
import { F, P } from '~/schemas'

const getArticle = (thread) => {
  return gql`
    ${P[thread.toLowerCase()]}
  `
}

const setTag = gql`
  ${P.setTag}
`
const unsetTag = gql`
  ${P.unsetTag}
`

const schema = {
  setTag,
  unsetTag,
  getArticle,
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
}

export default schema
