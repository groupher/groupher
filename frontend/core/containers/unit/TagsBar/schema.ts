import { gql } from 'urql'
import { F } from '~/schemas'

const pagedArticleTags = gql`
  query($filter: ArticleTagsFilter) {
    pagedArticleTags(filter: $filter) {
      entries {
        ${F.tag}
      }
    }
  }
`

const schema = {
  pagedArticleTags,
}

export default schema
