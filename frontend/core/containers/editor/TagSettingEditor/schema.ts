import { gql } from 'urql'

const deleteArticleTag = gql`
  mutation ($id: ID!, $community: String!, $thread: Thread) {
    deleteArticleTag(id: $id, community: $community, thread: $thread) {
      id
    }
  }
`
const createArticleTag = gql`
  mutation (
    $thread: Thread!
    $title: String!
    $slug: String!
    $desc: String
    $layout: String
    $color: RainbowColor!
    $group: String
    $community: String!
  ) {
    createArticleTag(
      thread: $thread
      title: $title
      desc: $desc
      slug: $slug
      color: $color
      group: $group
      community: $community
    ) {
      id
    }
  }
`
const updateArticleTag = gql`
  mutation (
    $id: ID!
    $color: RainbowColor
    $title: String
    $layout: String
    $desc: String
    $slug: String
    $community: String!
    $group: String
  ) {
    updateArticleTag(
      id: $id
      color: $color
      title: $title
      desc: $desc
      layout: $layout
      slug: $slug
      community: $community
      group: $group
    ) {
      id
    }
  }
`

const schema = {
  deleteArticleTag,
  createArticleTag,
  updateArticleTag,
}

export default schema
