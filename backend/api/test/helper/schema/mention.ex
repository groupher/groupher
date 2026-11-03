defmodule GroupherServer.Test.Helper.Schema.Mention do
  @moduledoc "GraphQL documents for the Community-scoped public Mention contract."

  def q(:mentions) do
    """
    query($community: String!, $source: MentionSourceInput!, $pagi: PagiInput) {
      mentions(community: $community, source: $source, pagi: $pagi) {
        entries {
          id
          mentionerType
          mentionerUrl
          mentionedScope
          mentionedType
          mentionedUrl
          mentionCase
          occurrencesCount
          mentionedAt
        }
        pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } }
      }
    }
    """
  end

  def q(:mentioned_by) do
    """
    query($community: String!, $target: MentionTargetInput!, $pagi: PagiInput) {
      mentionedBy(community: $community, target: $target, pagi: $pagi) {
        entries {
          id
          mentionerType
          mentionerUrl
          mentionedScope
          mentionedType
          mentionedUrl
          mentionCase
          occurrencesCount
          mentionedAt
        }
        pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } }
      }
    }
    """
  end

  def q(:mentions_2) do
    """
    query($community: String!, $source: MentionSourceInput!) {
      mentions(community: $community, source: $source) {
        entries { id mentionerType mentionerUrl mentionedType mentionedUrl occurrencesCount }
        pageInfo { hasNextPage ... on OffsetPageInfo { totalCount page size } }
      }
    }
    """
  end
end
