import { gql } from 'urql'
import { F } from '~/schemas'
import { setTag as setTagMutation, unsetTag as unsetTagMutation } from '../../schemas/pages/action'
import { changelog } from '../../schemas/pages/changelog'
import { doc } from '../../schemas/pages/doc'
import { post } from '../../schemas/pages/post'

const ARTICLE_SCHEMA = {
  post,
  changelog,
  doc,
}

const getArticle = (thread) => {
  const schema = ARTICLE_SCHEMA[thread.toLowerCase()]

  return gql`
    ${schema}
  `
}

const setTag = gql`
  ${setTagMutation}
`
const unsetTag = gql`
  ${unsetTagMutation}
`

const schema = {
  setTag,
  unsetTag,
  getArticle,
  getUpvote: F.getUpvote,
  getUndoUpvote: F.getUndoUpvote,
}

export default schema
