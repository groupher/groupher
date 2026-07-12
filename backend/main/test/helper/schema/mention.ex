defmodule GroupherServer.Test.Helper.Schema.Mention do
  @moduledoc "GraphQL documents used by mention tests."

  def q(:mentions) do
    """
    query($source: MentionSourceInput!, $filter: PagiFilter!) {
          mentions(source: $source, filter: $filter) {
            entries {
              mentionerType
              mentionerId
              mentionerCommunityId
              mentionedScope
              mentionedType
              mentionedId
              mentionedCommunityId
              mentionedUrl
              mentionCase
              occurrences
            }
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:mentioned_by) do
    """
    query($target: MentionTargetInput!, $filter: PagiFilter!) {
          mentionedBy(target: $target, filter: $filter) {
            entries {
              mentionerType
              mentionerId
              mentionerCommunityId
              mentionedType
              mentionedId
              mentionedCommunityId
              mentionCase
            }
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:mentions_2) do
    """
    query($source: MentionSourceInput!) {
          mentions(source: $source) {
            entries {
              mentionerType
              mentionerId
              mentionedType
              mentionedId
            }
            totalCount
          }
        }
    """
  end
end
