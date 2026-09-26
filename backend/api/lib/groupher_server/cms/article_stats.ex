defmodule GroupherServer.CMS.ArticleStats do
  @moduledoc """
  Owns field-scoped writes and public reads for the ArticleStats read model.

      Publish       -> initialize
      ViewTracker   -> increment_views
      Comments      -> apply_comment_counts
      Interactions  -> apply_interaction_counts
                         |
                         v
                  cms.article_stats

  Every owner writes only its count/revision fields plus the shared
  `snapshot_at`. There is no production API that rebuilds the complete row.
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.Matcher
  alias CMS.Artiment.Threads
  alias CMS.Model.ArticleStats, as: ArticleStatsModel

  @article_threads Threads.article_enums()
  @article_emotions CMS.Artiment.Config.emotions()
  @conflict_target [:thread, :article_id]

  @doc "Creates the zero-valued public row on first publish without overwriting an existing row."
  @spec initialize(struct()) :: :ok | {:error, term()}
  def initialize(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article) do
      Repo.insert_all(
        ArticleStatsModel,
        [%{thread: thread, article_id: article.id}],
        on_conflict: :nothing,
        conflict_target: @conflict_target
      )

      :ok
    end
  end

  @doc "Atomically increments the ViewTracker-owned counter and returns the complete row."
  @spec increment_views(atom(), pos_integer()) :: {:ok, map()} | {:error, term()}
  def increment_views(thread, article_id)
      when thread in @article_threads and is_integer(article_id) and article_id > 0 do
    conflict_query =
      from(stats in ArticleStatsModel,
        update: [
          inc: [views: 1, views_revision: 1],
          set: [
            snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
            updated_at: fragment("date_trunc('second', clock_timestamp())")
          ]
        ]
      )

    case Repo.insert_all(
           ArticleStatsModel,
           [%{thread: thread, article_id: article_id, views: 1, views_revision: 1}],
           on_conflict: conflict_query,
           conflict_target: @conflict_target,
           returning: true
         ) do
      {1, [%ArticleStatsModel{} = stats]} -> {:ok, normalize(stats)}
      {1, [stats]} when is_map(stats) -> {:ok, normalize(struct(ArticleStatsModel, stats))}
      _ -> {:error, :article_stats_not_updated}
    end
  end

  @doc "UPSERTs every Comments-owned ArticleStats field from one canonical Article row."
  @spec apply_comment_counts(struct()) :: :ok | {:error, term()}
  def apply_comment_counts(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article),
         {:ok, comments_count} <- owner_count(article, :comments_count),
         {:ok, participants_count} <- owner_count(article, :comments_participants_count),
         {:ok, comments_revision} <- owner_count(article, :comments_revision) do
      conflict_query =
        from(stats in ArticleStatsModel,
          update: [
            set: [
              comments_count: ^comments_count,
              comments_participants_count: ^participants_count,
              comments_revision: ^comments_revision,
              snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
              updated_at: fragment("date_trunc('second', clock_timestamp())")
            ]
          ]
        )

      Repo.insert_all(
        ArticleStatsModel,
        [
          %{
            thread: thread,
            article_id: article.id,
            comments_count: comments_count,
            comments_participants_count: participants_count,
            comments_revision: comments_revision
          }
        ],
        on_conflict: conflict_query,
        conflict_target: @conflict_target
      )

      :ok
    end
  end

  @doc "UPSERTs every Interactions-owned field from its canonical projection facts."
  @spec apply_interaction_counts(struct()) :: :ok | {:error, term()}
  def apply_interaction_counts(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article),
         counts when is_map(counts) <- CMS.Interactions.counts([article]),
         {:ok, interaction} <- owner_facts(counts, {thread, article.id}),
         {:ok, upvotes_count} <- owner_count(interaction, :upvotes_count),
         {:ok, collects_count} <- owner_count(interaction, :collects_count),
         {:ok, interaction_revision} <- owner_count(interaction, :interaction_revision),
         {:ok, reaction_counts} <- encode_reaction_counts(interaction) do
      conflict_query =
        from(stats in ArticleStatsModel,
          update: [
            set: [
              upvotes_count: ^upvotes_count,
              collects_count: ^collects_count,
              interaction_revision: ^interaction_revision,
              reaction_counts: ^reaction_counts,
              snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
              updated_at: fragment("date_trunc('second', clock_timestamp())")
            ]
          ]
        )

      Repo.insert_all(
        ArticleStatsModel,
        [
          %{
            thread: thread,
            article_id: article.id,
            upvotes_count: upvotes_count,
            collects_count: collects_count,
            interaction_revision: interaction_revision,
            reaction_counts: reaction_counts
          }
        ],
        on_conflict: conflict_query,
        conflict_target: @conflict_target
      )

      :ok
    end
  end

  @doc "Repairs only Comments-owned fields from the current physical Article row."
  @spec rebuild_comment_fields(struct()) :: :ok | {:error, term()}
  def rebuild_comment_fields(article) when is_struct(article) do
    case Repo.get(article.__struct__, article.id) do
      %{} = current -> apply_comment_counts(current)
      nil -> {:error, :article_not_found}
    end
  end

  @doc "Repairs only Interactions-owned fields from current owner facts."
  @spec rebuild_interaction_fields(struct()) :: :ok | {:error, term()}
  def rebuild_interaction_fields(article) when is_struct(article) do
    case Repo.get(article.__struct__, article.id) do
      %{} = current -> apply_interaction_counts(current)
      nil -> {:error, :article_not_found}
    end
  end

  @doc "Removes the public row during permanent Article deletion."
  @spec delete(atom(), pos_integer()) :: :ok
  def delete(thread, article_id) do
    Repo.delete_all(
      from(stats in ArticleStatsModel,
        where: stats.thread == ^thread and stats.article_id == ^article_id
      )
    )

    :ok
  end

  @doc "Returns one row by physical Article identity."
  @spec fetch(atom(), pos_integer()) :: {:ok, map()} | {:error, :article_stats_not_found}
  def fetch(thread, article_id) when thread in @article_threads and is_integer(article_id) do
    case Repo.get_by(ArticleStatsModel, thread: thread, article_id: article_id) do
      %ArticleStatsModel{} = stats -> {:ok, normalize(stats)}
      nil -> {:error, :article_stats_not_found}
    end
  end

  @doc "Returns projection rows keyed by `{thread, article_id}`."
  @spec for_articles(atom(), [struct()]) :: map()
  def for_articles(thread, articles) when thread in @article_threads and is_list(articles) do
    ids = Enum.map(articles, & &1.id)

    from(stats in ArticleStatsModel,
      where: stats.thread == ^thread and stats.article_id in ^ids
    )
    |> Repo.all()
    |> Map.new(&{{&1.thread, &1.article_id}, normalize(&1)})
  end

  @doc "Returns a public projection batch keyed by Article inner id."
  @spec public_batch(atom(), [integer()]) :: map()
  def public_batch(thread, ids) when thread in @article_threads and is_list(ids) do
    from(stats in ArticleStatsModel,
      where: stats.thread == ^thread and stats.article_id in ^ids
    )
    |> Repo.all()
    |> Map.new(fn stats -> {to_string(stats.article_id), normalize(stats)} end)
  end

  defp article_thread(article) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         true <- thread in @article_threads do
      {:ok, thread}
    else
      false -> {:error, :unsupported_article_thread}
      {:error, _} = error -> error
    end
  end

  defp normalize(%ArticleStatsModel{} = stats) do
    %{
      thread: stats.thread,
      article_id: stats.article_id,
      views: stats.views,
      views_revision: stats.views_revision,
      upvotes_count: stats.upvotes_count,
      comments_count: stats.comments_count,
      collects_count: stats.collects_count,
      comments_participants_count: stats.comments_participants_count,
      interaction_revision: stats.interaction_revision,
      comments_revision: stats.comments_revision,
      reaction_counts: normalize_reaction_counts(stats.reaction_counts),
      snapshot_at: stats.snapshot_at
    }
  end

  defp owner_facts(counts, identity) do
    case Map.fetch(counts, identity) do
      {:ok, facts} when is_map(facts) ->
        {:ok, facts}

      :error ->
        {:ok,
         %{
           upvotes_count: 0,
           collects_count: 0,
           interaction_revision: 0,
           reaction_counts: []
         }}

      _ ->
        {:error, {:invalid_owner_facts, identity}}
    end
  end

  defp owner_count(owner, field) do
    case Map.fetch(owner, field) do
      {:ok, value} when is_integer(value) and value >= 0 -> {:ok, value}
      _ -> {:error, {:invalid_owner_count, field}}
    end
  end

  defp normalize_non_negative(value) when is_integer(value) and value >= 0, do: value
  defp normalize_non_negative(_value), do: 0

  defp normalize_reaction_counts(counts) when is_list(counts) do
    counts
    |> Enum.map(&normalize_reaction_count/1)
    |> Enum.reject(&is_nil/1)
  end

  defp normalize_reaction_counts(counts) when is_map(counts) do
    counts
    |> Enum.map(fn {type, count} -> normalize_reaction_count(%{type: type, count: count}) end)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(fn %{count: count, type: type} -> {-count, Atom.to_string(type)} end)
  end

  defp normalize_reaction_counts(_), do: []

  defp encode_reaction_counts(interaction) do
    case Map.fetch(interaction, :reaction_counts) do
      {:ok, counts} when is_list(counts) ->
        Enum.reduce_while(counts, {:ok, %{}}, fn count, {:ok, acc} ->
          with true <- is_map(count),
               type when not is_nil(type) <-
                 atomize_emotion(Map.get(count, :type) || Map.get(count, "type")),
               {:ok, value} <- reaction_count(count) do
            {:cont, {:ok, Map.put(acc, Atom.to_string(type), value)}}
          else
            _ -> {:halt, {:error, :invalid_reaction_counts}}
          end
        end)

      _ ->
        {:error, :invalid_reaction_counts}
    end
  end

  defp reaction_count(count) do
    value = Map.get(count, :count) || Map.get(count, "count")

    if is_integer(value) and value >= 0,
      do: {:ok, value},
      else: {:error, :invalid_reaction_count}
  end

  defp normalize_reaction_count(count) when is_map(count) do
    case atomize_emotion(Map.get(count, "type") || Map.get(count, :type)) do
      nil ->
        nil

      type ->
        %{
          type: type,
          count: normalize_non_negative(Map.get(count, "count") || Map.get(count, :count))
        }
    end
  end

  defp normalize_reaction_count(_), do: nil

  defp atomize_emotion(value) when is_atom(value), do: if(value in @article_emotions, do: value)

  defp atomize_emotion(value) when is_binary(value) do
    Enum.find(@article_emotions, &(Atom.to_string(&1) == value))
  end

  defp atomize_emotion(_value), do: nil
end
