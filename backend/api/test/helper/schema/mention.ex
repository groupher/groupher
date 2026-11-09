defmodule GroupherServer.Test.Helper.Schema.Mention do
  @moduledoc "GraphQL documents for the Community-scoped public Mention contract."

  def q(:mentions) do
    """
    query($community: String!, $source: MentionsGraphLocatorInput!, $pagi: PagiInput) {
      mentions(community: $community, source: $source, pagi: $pagi) {
        revision
        entries {
          id
          source { type status url }
          targetType
          target {
            __typename
            ... on MentionsGraphNode { type status url }
            ... on MentionUserTarget { type status login displayName url }
            ... on MentionUrlTarget { type url }
          }
          mentionCase
          occurrencesCount
          mentionedAt
        }
        pageInfo { hasNextPage ... on CursorPageInfo { endCursor hasPreviousPage } ... on OffsetPageInfo { page size totalCount totalPages } }
        }
    }
    """
  end

  def q(:mentioned_by) do
    """
    query($community: String!, $target: MentionTargetInput!, $pagi: PagiInput) {
      mentionedBy(community: $community, target: $target, pagi: $pagi) {
        revision
        entries {
          id
          source { type status url }
          targetType
          target {
            __typename
            ... on MentionsGraphNode { type status url }
            ... on MentionUserTarget { type status login displayName url }
            ... on MentionUrlTarget { type url }
          }
          mentionCase
          occurrencesCount
          mentionedAt
        }
        pageInfo { hasNextPage ... on CursorPageInfo { endCursor hasPreviousPage } ... on OffsetPageInfo { page size totalCount totalPages } }
        }
    }
    """
  end

  def q(:mentions_2), do: q(:mentions)
end
