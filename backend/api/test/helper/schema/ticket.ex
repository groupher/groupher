defmodule GroupherServer.Test.Helper.Schema.Ticket do
  @moduledoc "GraphQL documents used by Ticket query tests."

  def q(:post_progress) do
    """
    query($community: String!, $ids: [Int!]!) {
      postTicketProgress(community: $community, postInnerIds: $ids) {
        postInnerId status completed total tickets { innerId title status }
      }
    }
    """
  end

  def q(:ticket) do
    """
    query($community: String!, $innerId: Int!) {
      ticket(community: $community, innerId: $innerId) {
        id
        innerId
        type
        status
        publicationState
        title
        digest
        draftContent { title digest }
        publishedContent { title digest }
        hasUnpublishedChanges
        publicationPreview
        sources { id type innerId title }
      }
    }
    """
  end

  def q(:ticket_internal) do
    """
    query($community: String!, $id: ID!) {
      ticketInternal(community: $community, id: $id) {
        id
        innerId
        type
        status
        publicationState
        title
        digest
        draftVersion
        lifecycleVersion
        workflowVersion
        draftContent { title digest }
        publishedContent { title digest }
        hasUnpublishedChanges
        publicationPreview
        sources { id type innerId title }
      }
    }
    """
  end
end
