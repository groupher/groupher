export const setTag = `
  mutation($article: ArticlePathInput!, $tagId: ID!) {
    setCommunityTag(article: $article, communityTagId: $tagId) {
      innerId
      title
    }
  }
`
export const unsetTag = `
  mutation($article: ArticlePathInput!, $tagId: ID!) {
    unsetCommunityTag(article: $article, communityTagId: $tagId) {
      innerId
      title
    }
  }
`

export const follow = `
  mutation($login: String!) {
    follow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`

export const undoFollow = `
  mutation($login: String!) {
    undoFollow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`
