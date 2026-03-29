defmodule GroupherServer.CMS.Comments.Emotion do
  @moduledoc """
  Emotion operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.{CanCan, Events, FrontDesk}
  alias CMS.Helper.EmotionToggle
  alias CMS.Model.{Comment, CommentUserEmotion}

  alias Helper.{Multi, Later, T, Transaction}

  @latest_emotion_users_limit 4

  @type t_user_list :: [
          %{
            id: integer(),
            user_id: integer(),
            login: String.t(),
            nickname: String.t() | nil,
            avatar: String.t() | nil
          }
        ]
  @type t_mention_status :: %{user_list: t_user_list, user_count: integer()}

  @spec set(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def set(comment_id, emotion, %User{} = user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id) do
      with {:ok, article} <- FrontDesk.article_of(comment),
           :ok <- CanCan.ensure_emotion_allowed(article.community_slug, :comment, comment.thread, emotion) do
        Transaction.lock_row(comment, fn locked_comment ->
          target = %{
            comment_id: locked_comment.id,
            recived_user_id: locked_comment.author_id,
            user_id: user.id
          }

          Multi.new()
          |> Multi.run(:persist_user_emotion, fn _, _ ->
            EmotionToggle.persist(CommentUserEmotion, target, emotion, true)
          end)
          |> Multi.run(:update_emotions_field, fn _, %{persist_user_emotion: changed?} ->
            update_emotion_embed(locked_comment, emotion, user, changed?, :add)
          end)
          |> Multi.run(:after_events, fn _, _ ->
            Later.run({Events, :emit, [:subscribe_community, %{target: locked_comment, user: user}]})
          end)
          |> Repo.transaction()
          |> result
        end)
      end
    end
  end

  @spec undo(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def undo(comment_id, emotion, %User{} = user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id) do
      with {:ok, article} <- FrontDesk.article_of(comment),
           :ok <- CanCan.ensure_emotion_allowed(article.community_slug, :comment, comment.thread, emotion) do
        Transaction.lock_row(comment, fn locked_comment ->
          target = %{
            comment_id: locked_comment.id,
            recived_user_id: locked_comment.author_id,
            user_id: user.id
          }

          Multi.new()
          |> Multi.run(:persist_user_emotion, fn _, _ ->
            EmotionToggle.persist(CommentUserEmotion, target, emotion, false)
          end)
          |> Multi.run(:update_emotions_field, fn _, %{persist_user_emotion: changed?} ->
            update_emotion_embed(locked_comment, emotion, user, changed?, :remove)
          end)
          |> Repo.transaction()
          |> result
        end)
      end
    end
  end

  @spec query_latest_emotion_users(Comment.t(), atom()) :: [map()]
  defp query_latest_emotion_users(comment, emotion) do
    query =
      from(a in CommentUserEmotion,
        join: user in User,
        on: a.user_id == user.id,
        where: a.comment_id == ^comment.id,
        where: a.emotion == ^to_string(emotion),
        order_by: [desc: a.updated_at, desc: a.id],
        limit: @latest_emotion_users_limit,
        select: %{
          id: user.id,
          user_id: user.id,
          login: user.login,
          nickname: user.nickname,
          avatar: user.avatar
        }
      )

    Repo.all(query)
  end

  defp result({:ok, %{update_emotions_field: result}}), do: {:ok, result}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end

  defp update_emotion_embed(comment, _emotion, user, false, _opt) do
    FrontDesk.mark_viewer_emotion_states(comment, user) |> done
  end

  defp update_emotion_embed(comment, emotion, user, true, opt) do
    with {:ok, comment} <-
           EmotionToggle.update_embed(comment, emotion, user, opt, fn ->
             query_latest_emotion_users(comment, emotion)
           end),
         {:ok, comment} <- FrontDesk.sync_embed_replies(comment) do
      FrontDesk.mark_viewer_emotion_states(comment, user) |> done
    end
  end
end
