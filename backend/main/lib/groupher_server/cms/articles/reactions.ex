defmodule GroupherServer.CMS.Articles.Reactions do
  @moduledoc """
  Article reactions helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.{CanCan, FrontDesk}
  alias CMS.Helper.EmotionToggle
  alias CMS.Model.ArticleUserEmotion
  alias Helper.{Multi, T, Transaction}

  import Ecto.Query

  @latest_emotion_users_limit 4

  @spec emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def emotion(article, emotion, %User{} = user) do
    {:ok, info} = match(article)
    with {:ok, thread} <- FrontDesk.thread_of(article),
         :ok <- CanCan.ensure_emotion_allowed(article.community_slug, :article, thread, emotion) do
      Transaction.lock_row(article, fn article ->
        target =
          %{recived_user_id: article.author.user_id, user_id: user.id}
          |> Map.put(info.foreign_key, article.id)

        Multi.new()
        |> Multi.run(:persist_user_emotion, fn _, _ ->
          EmotionToggle.persist(ArticleUserEmotion, target, emotion, true)
        end)
        |> Multi.run(:update_emotions_field, fn _, %{persist_user_emotion: changed?} ->
          update_emotion_embed(article, emotion, user, changed?, :add)
        end)
        |> Repo.transaction()
        |> update_emotions_field_result()
      end)
    end
  end

  @spec undo_emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def undo_emotion(article, emotion, %User{} = user) do
    {:ok, info} = match(article)
    with {:ok, thread} <- FrontDesk.thread_of(article),
         :ok <- CanCan.ensure_emotion_allowed(article.community_slug, :article, thread, emotion) do
      Transaction.lock_row(article, fn article ->
        target =
          %{recived_user_id: article.author.user_id, user_id: user.id}
          |> Map.put(info.foreign_key, article.id)

        Multi.new()
        |> Multi.run(:persist_user_emotion, fn _, _ ->
          EmotionToggle.persist(ArticleUserEmotion, target, emotion, false)
        end)
        |> Multi.run(:update_emotions_field, fn _, %{persist_user_emotion: changed?} ->
          update_emotion_embed(article, emotion, user, changed?, :remove)
        end)
        |> Repo.transaction()
        |> update_emotions_field_result()
      end)
    end
  end

  defp query_latest_emotion_users(article, emotion) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, info} <- match(thread) do
      query =
        from(a in ArticleUserEmotion,
          join: user in User,
          on: a.user_id == user.id,
          where: field(a, ^info.foreign_key) == ^article.id,
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
      {:ok, Repo.all(query)}
    end
  end

  defp update_emotions_field_result({:ok, %{update_emotions_field: result}}), do: {:ok, result}

  defp update_emotions_field_result({:error, _, result, _steps}) do
    {:error, result}
  end

  defp update_emotion_embed(article, _emotion, user, false, _opt) do
    {:ok, FrontDesk.mark_viewer_emotion_states(article, user)}
  end

  defp update_emotion_embed(article, emotion, user, true, opt) do
    with {:ok, latest_users} <- query_latest_emotion_users(article, emotion),
         {:ok, article} <-
           EmotionToggle.update_embed(article, emotion, user, opt, fn -> latest_users end) do
      {:ok, FrontDesk.mark_viewer_emotion_states(article, user)}
    end
  end
end
