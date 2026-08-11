import { graphql } from '~/graphql/authoring'

const simpleQuery = graphql(`
  query RichEditorSimpleQuery($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
    }
  }
`)

const schema = {
  simpleQuery,
}

export default schema
