import { thread2Path } from '~/utils/thread'

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
  const schema = ARTICLE_SCHEMA[thread2Path(thread)]

  return schema
}

const setTag = setTagMutation
const unsetTag = unsetTagMutation

const schema = {
  setTag,
  unsetTag,
  getArticle,
}

export default schema
