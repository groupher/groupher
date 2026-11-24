import { graphql } from '~/graphql/authoring'

import { docPublicTree } from '../../schemas/pages/doc'

export { docPublicTree }

export default {
  docPublicTree,
}

export const queueEditorPermissions = graphql(`
  query DocQueueEditorPermissions($articleId: ID!) {
    articlePermissions(articleId: $articleId) {
      articleId
      permissions
    }
  }
`)

export const queueMemberEditor = graphql(`
  query DocQueueMemberEditor($community: String!, $articleId: ID!) {
    docsQueueMember(community: $community, articleId: $articleId) {
      queueRevision
      workingCopy {
        id
        articleId
        scopeType
        scopeId
        revision
        title
        slug
        bodyJson
        threadFields
      }
    }
  }
`)
