import { graphql } from '~/graphql/authoring'

const updatePost = graphql(`
  mutation UpdatePostFromMenu($article: ArticlePathInput!, $title: String, $communityTags: [ID]) {
    updatePost(article: $article, title: $title, communityTags: $communityTags) {
      innerId
      title
      communityTags {
        ...ArticleMenuTagFields
      }
    }
  }
`)

const setPostCat = graphql(`
  mutation SetPostCat($article: ArticlePathInput!, $cat: ArticleCatEnum!) {
    setPostCat(article: $article, cat: $cat) {
      innerId
      cat
    }
  }
`)

const setPostStatus = graphql(`
  mutation SetPostStatus($article: ArticlePathInput!, $status: ArticleStatusEnum!) {
    setPostStatus(article: $article, status: $status) {
      innerId
      status
    }
  }
`)

const pinPost = graphql(`
  mutation PinPost($article: ArticlePathInput!) {
    pinPost(article: $article) {
      innerId
    }
  }
`)

const undoPinPost = graphql(`
  mutation UndoPinPost($article: ArticlePathInput!) {
    undoPinPost(article: $article) {
      innerId
      isPinned
    }
  }
`)

const communityTagGroups = graphql(`
  query CommunityTagGroupsForMenu($community: String!, $thread: Thread) {
    communityTagGroups(community: $community, thread: $thread) {
      id
      title
      index
      tags {
        ...ArticleMenuTagFields
      }
    }
  }
`)

export default {
  updatePost,
  setPostCat,
  setPostStatus,
  pinPost,
  undoPinPost,
  communityTagGroups,
}
