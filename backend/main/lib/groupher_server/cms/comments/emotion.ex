defmodule GroupherServer.CMS.Comments.Emotion do
  @moduledoc """
  Emotion operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]

  import GroupherServer.CMS.Delegate.Helper,
    only: [
      update_emotions_field: 4,
      mark_viewer_emotion_states: 2,
      sync_embed_replies: 1
    ]

  alias Helper.{ORM, Later}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, Repo}

  alias GroupherServer.CMS.Delegate.Hooks
  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.{Comment, CommentUserEmotion}

  alias Ecto.Multi

  @type t_user_list :: [%{login: String.t()}]
  @type t_mention_status :: %{user_list: t_user_list, user_count: integer()}

  @spec emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def emotion_to_comment(comment_id, emotion, %User{} = user) do
    with {:ok, comment} <- ORM.find(Comment, comment_id, preload: :author) do
      Multi.new()
      |> Multi.run(:create_user_emotion, fn _, _ ->
        target = %{
          comment_id: comment.id,
          recived_user_id: comment.author.id,
          user_id: user.id
        }

        args = Map.put(target, :"#{emotion}", true)

        case ORM.find_by(CommentUserEmotion, target) do
          {:ok, comment_user_emotion} -> ORM.update(comment_user_emotion, args)
          {:error, _} -> ORM.create(CommentUserEmotion, args)
        end
      end)
      |> Multi.run(:query_emotion_states, fn _, _ ->
        query_emotion_states(comment, emotion)
      end)
      |> Multi.run(:update_emotions_field, fn _, %{query_emotion_states: status} ->
        with {:ok, comment} <- update_emotions_field(comment, emotion, status, user),
             {:ok, comment} <- sync_embed_replies(comment) do
          mark_viewer_emotion_states(comment, user) |> done
        end
      end)
      |> Multi.run(:after_hooks, fn _, _ ->
        Later.run({Hooks.SubscribeCommunity, :handle, [comment, user]})
      end)
      |> Repo.transaction()
      |> result
    end
  end

  @spec undo_emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def undo_emotion_to_comment(comment_id, emotion, %User{} = user) do
    with {:ok, comment} <- ORM.find(Comment, comment_id, preload: :author) do
      Multi.new()
      |> Multi.run(:update_user_emotion, fn _, _ ->
        target = %{
          comment_id: comment.id,
          recived_user_id: comment.author.id,
          user_id: user.id
        }

        case ORM.find_by(CommentUserEmotion, target) do
          {:ok, comment_user_emotion} ->
            args = Map.put(target, :"#{emotion}", false)
            comment_user_emotion |> ORM.update(args)

          {:error, _} ->
            ORM.create(CommentUserEmotion, target)
        end
      end)
      |> Multi.run(:query_emotion_states, fn _, _ ->
        query_emotion_states(comment, emotion)
      end)
      |> Multi.run(:update_emotions_field, fn _, %{query_emotion_states: status} ->
        with {:ok, comment} <- update_emotions_field(comment, emotion, status, user) do
          mark_viewer_emotion_states(comment, user) |> done
        end
      end)
      |> Repo.transaction()
      |> result
    end
  end

  @spec query_emotion_states(Comment.t(), atom()) :: {:ok, t_mention_status}
  defp query_emotion_states(comment, emotion) do
    query =
      from(a in CommentUserEmotion,
        join: user in User,
        on: a.user_id == user.id,
        where: a.comment_id == ^comment.id,
        where: field(a, ^emotion) == true,
        select: %{login: user.login, nickname: user.nickname}
      )

    emotioned_user_info_list = Repo.all(query) |> Enum.uniq()
    emotioned_user_count = length(emotioned_user_info_list)

    {:ok, %{user_list: emotioned_user_info_list, user_count: emotioned_user_count}}
  end

  defp result({:ok, %{update_emotions_field: result}}), do: {:ok, result}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
