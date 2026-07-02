import { gql } from 'urql'

const simpleMutation = gql`
  mutation ($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
    }
  }
`
const simpleQuery = gql`
  query ($article: ArticlePathInput!) {
    post(article: $article) {
      innerId
    }
  }
`

const schema = {
  simpleMutation,
  simpleQuery,
}

export default schema
