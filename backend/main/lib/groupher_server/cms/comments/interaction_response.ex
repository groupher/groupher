defmodule GroupherServer.CMS.Comments.InteractionResponse do
  @moduledoc """
  Assembles Comment API response fields from Interaction viewer state and the
  separate Article-author relation state.

      Comments Reader -> InteractionResponse -> Comment API response
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Comments.AuthorRelationState
  alias GroupherServer.CMS.Model.PostSolution
  alias GroupherServer.Repo

  @doc """
  Assembles one Comment with Interaction and Article-author relation fields.

  ## Examples

      InteractionResponse.one(comment, viewer)

  """
  @spec one(struct(), GroupherServer.Accounts.Model.User.t() | nil, keyword()) ::
          {:ok, struct()} | {:error, term()}
  def one(comment, viewer, opts \\ []) do
    with {:ok, [comment]} <- many([comment], viewer, opts) do
      {:ok, comment}
    end
  end

  @doc """
  Assembles one Comment page, including embedded replies, from batched reads.

  ## Examples

      InteractionResponse.many(comments, viewer)

  """
  @spec many([struct()], GroupherServer.Accounts.Model.User.t() | nil, keyword()) ::
          {:ok, [struct()]} | {:error, term()}
  def many(comments, viewer, opts \\ []) when is_list(comments) do
    all_comments =
      comments
      |> Enum.flat_map(fn comment -> [comment | embedded_replies(comment)] end)
      |> Enum.uniq_by(& &1.id)

    with states when is_map(states) <- CMS.Interactions.viewer_states(all_comments, viewer, opts) do
      author_upvoted_ids = author_upvoted_ids(all_comments, opts)
      solution_ids = solution_ids(all_comments)

      hydrated_by_id =
        Map.new(all_comments, fn comment ->
          state = Map.fetch!(states, {:comment, comment.id})
          {comment.id, merge(comment, state, author_upvoted_ids, solution_ids)}
        end)

      top_level_by_id = Map.new(comments, &{&1.id, &1})

      by_id =
        Map.new(hydrated_by_id, fn {id, hydrated} ->
          case Map.get(top_level_by_id, id) do
            nil ->
              {id, hydrated}

            top_level ->
              {id,
               merge(
                 top_level,
                 Map.fetch!(states, {:comment, id}),
                 author_upvoted_ids,
                 solution_ids
               )}
          end
        end)

      comments =
        Enum.map(comments, fn comment ->
          hydrated = Map.fetch!(by_id, comment.id)
          replies = Enum.map(embedded_replies(comment), &Map.get(by_id, &1.id, &1))
          Map.put(hydrated, :replies, replies)
        end)

      {:ok, CMS.ShadowSync.refresh_comments(comments)}
    end
  end

  defp merge(comment, state, author_upvoted_ids, solution_ids) do
    comment
    |> Map.put(:upvotes_count, state.upvotes_count)
    |> Map.put(:viewer_has_upvoted, state.viewer_has_upvoted)
    |> Map.put(:viewer_has_reported, state.viewer_has_reported)
    |> Map.put(:is_solution, MapSet.member?(solution_ids, comment.id))
    |> Map.put(:emotions, emotion_map(state.emotions))
    |> Map.put(:meta, comment_meta(comment, state, author_upvoted_ids))
  end

  defp solution_ids([]), do: MapSet.new()

  defp solution_ids(comments) do
    ids = Enum.map(comments, & &1.id)

    PostSolution
    |> where([solution], solution.comment_id in ^ids)
    |> select([solution], solution.comment_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp comment_meta(comment, state, author_upvoted_ids) do
    meta =
      (comment.meta || %{})
      |> Map.put(:latest_upvoted_users, state.latest_upvoted_users)
      |> Map.put(:is_article_author_upvoted, MapSet.member?(author_upvoted_ids, comment.id))

    Map.put(meta, :reported_count, Map.get(state, :reported_count, 0))
  end

  defp emotion_map(emotions) do
    Enum.reduce(emotions, %{}, fn emotion, acc ->
      acc
      |> Map.put(:"#{emotion.emotion}_count", emotion.count)
      |> Map.put(:"latest_#{emotion.emotion}_users", emotion.latest_users)
      |> Map.put(:"viewer_has_#{emotion.emotion}ed", emotion.viewer_has_reacted)
    end)
  end

  defp author_upvoted_ids(comments, opts) do
    case Keyword.get(opts, :article_author_id) do
      author_id when is_integer(author_id) ->
        AuthorRelationState.upvoted_ids(Enum.map(comments, & &1.id), author_id)

      _ ->
        AuthorRelationState.upvoted_ids(comments)
    end
  end

  defp embedded_replies(%{replies: replies}) when is_list(replies), do: replies
  defp embedded_replies(_comment), do: []
end
