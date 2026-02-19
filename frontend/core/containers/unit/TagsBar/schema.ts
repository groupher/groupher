import { gql } from 'urql'
import { F } from '~/schemas'

const pagedCommunityTags = gql`
  query($filter: CommunityTagsFilter) {
    pagedCommunityTags(filter: $filter) {
      entries {
        ${F.tag}
      }
    }
  }
`

const schema = {
  pagedCommunityTags,
}

export default schema
