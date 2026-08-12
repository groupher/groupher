import { graphql } from '~/graphql/authoring'

const groupedKanbanPosts = graphql(`
  query GroupedKanbanPosts($community: String!) {
    groupedKanbanPosts(community: $community) {
      backlog {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...KanbanAuthorFields
          }
        }
        ...KanbanPageFields
      }
      todo {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...KanbanAuthorFields
          }
        }
        ...KanbanPageFields
      }
      wip {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...KanbanAuthorFields
          }
        }
        ...KanbanPageFields
      }
      done {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...KanbanAuthorFields
          }
        }
        ...KanbanPageFields
      }
      rejected {
        entries {
          innerId
          cat
          status
          title
          community {
            slug
          }
          meta {
            thread
          }
          author {
            ...KanbanAuthorFields
          }
        }
        ...KanbanPageFields
      }
    }
  }
`)

export default {
  groupedKanbanPosts,
}
