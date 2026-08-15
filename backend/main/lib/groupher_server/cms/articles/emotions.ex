defmodule GroupherServer.CMS.Articles.Emotions do
  @moduledoc """
  Article emotion writes backed by fact rows and reaction projections.

  Business position:

      GraphQL mutation -> CMS.Articles.Emotions -> emotion fact + interaction projection
  """

  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User

  alias CMS.FrontDesk
  alias CMS.Gate.Allow
  alias CMS.Interactions.State
  alias CMS.Helper.EmotionToggle
  alias CMS.Model.{ArticleUserEmotion, Author}
  alias Helper.{Multi, T}

  @spec emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def emotion(article, emotion, %User{} = user) do
    run_emotion(article, emotion, user, true)
  end

  @spec undo_emotion(term(), atom(), User.t()) :: T.domain_res(term())
  def undo_emotion(article, emotion, %User{} = user) do
    run_emotion(article, emotion, user, false)
  end

  defp run_emotion(article, emotion, user, desired_state) do
    {:ok, info} = match(article)
    article = Repo.preload(article, :community)

    with {:ok, thread} <- FrontDesk.thread_of(article),
         {:ok, _thread_key} <-
           Allow.emotion(article.community.slug, :article, thread, emotion) do
      toggle(article, info, emotion, user, desired_state)
    end
  end

  defp toggle(article, info, emotion, user, desired_state) do
    target =
      %{received_user_id: author_user_id(article), user_id: user.id}
      |> Map.put(info.foreign_key, article.id)

    Multi.new()
    |> Multi.run(:persist_user_emotion, fn _, _ ->
      EmotionToggle.persist(ArticleUserEmotion, target, emotion, desired_state)
    end)
    |> Multi.run(:sync_projection, fn _, %{persist_user_emotion: changed?} ->
      operation = if desired_state, do: :add, else: :remove

      with :ok <- maybe_sync_projection(article, emotion, user, changed?, operation) do
        {:ok, State.read(article, user)}
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  defp maybe_sync_projection(_article, _emotion, _user, false, _operation), do: :ok

  defp maybe_sync_projection(article, emotion, user, true, operation) do
    case State.write(article, {:emotion, emotion}, user, operation) do
      {:ok, _projection} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp author_user_id(%{author: %{user_id: user_id}}), do: user_id
  defp author_user_id(%{author_id: author_id}), do: Repo.get!(Author, author_id).user_id

  defp result({:ok, %{sync_projection: article}}), do: {:ok, article}
  defp result({:error, _, result, _steps}), do: {:error, result}
end
