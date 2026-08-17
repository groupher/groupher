defmodule GroupherServer.CMS.Comments.Upvotes do
  @moduledoc """
  Comment upvotes backed by a fact row and the comment reaction projection.

  Business position:

      GraphQL mutation -> CMS.Comments.Upvotes -> upvote fact + interaction projection
  """

  import Helper.ErrorCode

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User

  alias CMS.{Events, FrontDesk, Gate}
  alias CMS.Interactions.State
  alias CMS.Model.{Comment, CommentUpvote}
  alias Helper.{Later, Multi, ORM, T}

  @spec upvote(T.id(), User.t()) :: T.domain_res(Comment.t())
  def upvote(comment_id, %User{id: user_id} = from_user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, comment} <- Gate.access_check(from_user, :upvote, comment) do
      Multi.new()
      |> Multi.run(:create_comment_upvote, fn _, _ ->
        ORM.create(CommentUpvote, %{comment_id: comment.id, user_id: user_id})
      end)
      |> Multi.run(:sync_projection, fn _, _ ->
        with {:ok, _projection} <- State.write(comment, :upvote, from_user, :add) do
          {:ok, State.read(comment, from_user)}
        end
      end)
      |> Repo.transaction()
      |> result()
      |> emit_after_commit(:upvote, comment, from_user)
    end
  end

  @spec undo(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo(comment_id, %User{id: user_id} = from_user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, comment} <- Gate.access_check(from_user, :upvote, comment) do
      Multi.new()
      |> Multi.run(:find_comment_upvote, fn _, _ ->
        case ORM.find_by(CommentUpvote, %{comment_id: comment.id, user_id: user_id}) do
          {:ok, record} -> {:ok, record}
          {:error, _} -> {:ok, nil}
        end
      end)
      |> Multi.run(:delete_comment_upvote, fn _, %{find_comment_upvote: record} ->
        case record do
          nil -> {:ok, comment}
          record -> ORM.delete(record)
        end
      end)
      |> Multi.run(:sync_projection, fn _, %{find_comment_upvote: record} ->
        case record do
          nil ->
            {:ok, State.read(comment, from_user)}

          _ ->
            with {:ok, _projection} <-
                   State.write(comment, :upvote, from_user, :remove) do
              {:ok, State.read(comment, from_user)}
            end
        end
      end)
      |> Repo.transaction()
      |> result()
      |> emit_after_commit(:undo_upvote, comment, from_user)
    end
  end

  defp result({:ok, %{sync_projection: comment}}), do: {:ok, comment}

  defp result({:error, :create_comment_upvote, _result, _steps}) do
    raise_error(:comment_already_upvote, "already upvoted")
  end

  defp result({:error, _, result, _steps}), do: {:error, result}

  defp emit_after_commit({:ok, comment} = result, :upvote, _target, user) do
    Later.run({Events, :emit, [:subscribe_community, %{target: comment, user: user}]})
    Later.run({Events, :emit, [:notify_upvote, %{target: comment, from_user: user}]})
    result
  end

  defp emit_after_commit({:ok, comment} = result, :undo_upvote, _target, user) do
    Later.run({Events, :emit, [:notify_undo_upvote, %{target: comment, from_user: user}]})
    result
  end

  defp emit_after_commit(result, _action, _target, _user), do: result
end
