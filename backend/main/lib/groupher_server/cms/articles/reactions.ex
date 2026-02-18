defmodule GroupherServer.CMS.Articles.Reactions do
  @moduledoc """
  Article reactions helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher

  import Helper.Utils, only: [thread_of: 1]
  import GroupherServer.CMS.Delegate.Helper, only: [update_emotions_field: 4]

  alias Ecto.Multi
  alias Helper.{Transaction, ORM}
  alias Helper.Types, as: T
  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.ArticleUserEmotion

  import Ecto.Query

  @spec emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def emotion(article, emotion, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:create_user_emotion, fn _, _ ->
        target =
          %{recived_user_id: article.author.user_id, user_id: user.id}
          |> Map.put(info.foreign_key, article.id)

        args = Map.put(target, :"#{emotion}", true)

        case ORM.find_by(ArticleUserEmotion, target) do
          {:ok, article_user_emotion} -> ORM.update(article_user_emotion, args)
          {:error, _} -> ORM.create(ArticleUserEmotion, args)
        end
      end)
      |> Multi.run(:query_emotion_status, fn _, _ ->
        query_emotion_status(article, emotion)
      end)
      |> Multi.run(:update_emotions_field, fn _, %{query_emotion_status: status} ->
        update_emotions_field(article, emotion, status, user)
      end)
      |> Repo.transaction()
      |> update_emotions_field_result()
    end)
  end

  @spec undo_emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def undo_emotion(article, emotion, %User{} = user) do
    {:ok, info} = match(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:update_user_emotion, fn _, _ ->
        target =
          %{recived_user_id: article.author.user_id, user_id: user.id}
          |> Map.put(info.foreign_key, article.id)

        case ORM.find_by(ArticleUserEmotion, target) do
          {:ok, article_user_emotion} ->
            args = Map.put(target, :"#{emotion}", false)
            article_user_emotion |> ORM.update(args)

          {:error, _} ->
            {:ok, :pass}
        end
      end)
      |> Multi.run(:query_emotion_status, fn _, _ ->
        query_emotion_status(article, emotion)
      end)
      |> Multi.run(:update_emotions_field, fn _, %{query_emotion_status: status} ->
        update_emotions_field(article, emotion, status, user)
      end)
      |> Repo.transaction()
      |> update_emotions_field_result()
    end)
  end

  defp query_emotion_status(article, emotion) do
    with {:ok, thread} <- thread_of(article),
         {:ok, info} <- match(thread) do
      query =
        from(a in ArticleUserEmotion,
          join: user in User,
          on: a.user_id == user.id,
          where: field(a, ^info.foreign_key) == ^article.id,
          where: field(a, ^emotion) == true,
          select: %{login: user.login, nickname: user.nickname, avatar: user.avatar}
        )

      emotioned_user_info_list = Repo.all(query) |> Enum.uniq()
      emotioned_user_count = length(emotioned_user_info_list)

      {:ok, %{user_list: emotioned_user_info_list, user_count: emotioned_user_count}}
    end
  end

  defp update_emotions_field_result({:ok, %{update_emotions_field: result}}), do: {:ok, result}

  defp update_emotions_field_result({:error, _, result, _steps}) do
    {:error, result}
  end
end
