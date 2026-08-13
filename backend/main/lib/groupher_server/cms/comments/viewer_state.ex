defmodule GroupherServer.CMS.Comments.ViewerState do
  @moduledoc """
  Projects viewer-specific state onto comments.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> ViewerState
        -> Repo / domain event
  """

  alias GroupherServer.Accounts.Model.User

  @spec mark_has_upvoted(map(), User.t() | nil) :: map()
  def mark_has_upvoted(paged_comments, nil), do: paged_comments

  def mark_has_upvoted(%{entries: entries} = paged_comments, %User{} = user) do
    entries =
      Enum.map(
        entries,
        fn comment ->
          replies =
            Enum.map(comment.replies, fn reply_comment ->
              Map.merge(reply_comment, %{
                viewer_has_upvoted: Enum.member?(reply_comment.meta.upvoted_user_ids, user.id)
              })
            end)

          Map.merge(comment, %{
            viewer_has_upvoted: Enum.member?(comment.meta.upvoted_user_ids, user.id),
            replies: replies
          })
        end
      )

    Map.merge(paged_comments, %{entries: entries})
  end
end
