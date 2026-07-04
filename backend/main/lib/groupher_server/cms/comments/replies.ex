defmodule GroupherServer.CMS.Comments.Replies do
  @moduledoc """
  Helpers for resolving a reply thread's root comment.
  """

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.Comment
  alias Helper.{ORM, T}

  @spec root_comment(Comment.t()) :: Comment.t()
  def root_comment(%Comment{reply_to_comment_id: nil} = comment), do: comment

  def root_comment(%Comment{root_comment_id: root_id} = comment) when not is_nil(root_id) do
    case ORM.find(Comment, root_id) do
      {:ok, root_comment} -> root_comment
      _ -> comment
    end
  end

  def root_comment(%Comment{reply_to_comment_id: reply_to_comment_id} = comment)
      when not is_nil(reply_to_comment_id) do
    comment
    |> Repo.preload(reply_to_comment: :author)
    |> Map.get(:reply_to_comment)
    |> root_comment()
  end

  @spec root_id(T.id() | Comment.t()) :: T.domain_res(T.id())
  def root_id(%Comment{} = comment), do: {:ok, root_comment(comment).id}

  def root_id(comment_id) do
    with {:ok, comment} <- ORM.find(Comment, comment_id) do
      root_id(comment)
    end
  end
end
