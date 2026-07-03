defmodule GroupherServer.CMS.Comments.Read do
  @moduledoc """
  Read operations for comments.
  """

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User

  alias CMS.FrontDesk
  alias CMS.Model.Comment
  alias CMS.Comments.ViewerState
  alias Helper.T

  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id) do
    FrontDesk.comment(comment_id)
  end

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    FrontDesk.full_comment(comment_id)
  end

  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{} = comment), do: {:ok, comment}

  def one_comment(id), do: FrontDesk.comment(id)

  @spec one_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{} = comment, %User{} = user) do
    with {:ok, comment} <- one_comment(comment) do
      %{entries: [comment]}
      |> FrontDesk.mark_viewer_emotion_states(user)
      |> ViewerState.mark_has_upvoted(user)
      |> Map.get(:entries)
      |> List.first()
      |> done
    end
  end

  def one_comment(id, %User{} = user) do
    with {:ok, comment} <- one_comment(id) do
      one_comment(comment, user)
    end
  end
end
