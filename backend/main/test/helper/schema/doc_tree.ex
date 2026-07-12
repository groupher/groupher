defmodule GroupherServer.Test.Helper.Schema.DocTree do
  @moduledoc "GraphQL documents used by doc tree tests."

  def q(:doc_tree) do
    """
    query($community: String!) {
        docTree(community: $community) {
          revision
          treeState {
            hasUnpublishedChanges
            stagedEventCount
          }
          stagedEvents {
            eventType
          }
          tabs {
            id
            pins { id type title href }
            groups { id }
          }
        }
      }
    """
  end

  def q(:doc_public_tree) do
    """
    query($community: String!) {
        docPublicTree(community: $community) {
          tabs {
            id
            title
            groups {
              id
              title
              children { id docId type title href }
            }
          }
        }
      }
    """
  end
end
