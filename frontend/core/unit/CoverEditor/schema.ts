import { graphql } from '~/graphql/authoring'

const simpleQuery = graphql(`
  "Get post by id"
  query CoverSimpleQuery($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
    }
  }
`)

const schema = {
  simpleQuery,
}

export default schema
