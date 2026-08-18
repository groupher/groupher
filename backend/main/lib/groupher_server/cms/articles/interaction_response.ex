defmodule GroupherServer.CMS.Articles.InteractionResponse do
  @moduledoc """
  Assembles Article API response fields from Interaction read state.

  Interaction owns fact and viewer-state reads; Articles owns how that state is
  represented on the existing Article GraphQL response.

      Articles Reader -> InteractionResponse -> Article API response
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS

  @doc """
  Assembles one Article with Interaction fields for the optional viewer.

  ## Examples

      InteractionResponse.one(article, viewer)

  """
  @spec one(struct(), User.t() | nil, keyword()) :: {:ok, struct()} | {:error, term()}
  def one(article, viewer, opts \\ []) do
    case CMS.Interactions.viewer_state(article, viewer, opts) do
      state when is_map(state) ->
        {:ok, article |> merge(state) |> CMS.ShadowSync.refresh_article()}

      {:error, _reason} = error ->
        error
    end
  end

  @doc """
  Assembles one page of Articles from a batched Interaction read.

  ## Examples

      InteractionResponse.many(articles, viewer)

  """
  @spec many([struct()], User.t() | nil, keyword()) :: {:ok, [struct()]} | {:error, term()}
  def many(articles, viewer, opts \\ []) when is_list(articles) do
    with states when is_map(states) <- CMS.Interactions.viewer_states(articles, viewer, opts) do
      articles =
        Enum.map(articles, fn article ->
          {:ok, %{artiment: type}} = CMS.Artiment.Matcher.match_interaction(article)
          merge(article, Map.fetch!(states, {type, article.id}))
        end)

      {:ok, CMS.ShadowSync.refresh_articles(articles)}
    end
  end

  defp merge(article, state) do
    article
    |> Map.put(:upvotes_count, state.upvotes_count)
    |> Map.put(:collects_count, state.collects_count)
    |> Map.put(:viewer_has_upvoted, state.viewer_has_upvoted)
    |> Map.put(:viewer_has_collected, state.viewer_has_collected)
    |> Map.put(:viewer_has_reported, state.viewer_has_reported)
    |> Map.put(:viewer_has_viewed, state.viewer_has_viewed)
    |> Map.put(:emotions, emotion_map(state.emotions))
    |> Map.put(:meta, article_meta(article, state))
  end

  defp article_meta(article, state) do
    meta =
      (article.meta || %{})
      |> Map.put(:latest_upvoted_users, state.latest_upvoted_users)
      |> Map.put(:latest_collected_users, state.latest_collected_users)

    Map.put(meta, :reported_count, Map.get(state, :reported_count, 0))
  end

  defp emotion_map(emotions) do
    Map.new(emotions, fn emotion ->
      {emotion.emotion,
       %{
         count: emotion.count,
         latest_users: emotion.latest_users,
         viewer_has_reacted: emotion.viewer_has_reacted
       }}
    end)
    |> Enum.reduce(%{}, fn {emotion, state}, acc ->
      acc
      |> Map.put(:"#{emotion}_count", state.count)
      |> Map.put(:"latest_#{emotion}_users", state.latest_users)
      |> Map.put(:"viewer_has_#{emotion}ed", state.viewer_has_reacted)
    end)
  end
end
