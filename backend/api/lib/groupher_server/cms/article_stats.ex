defmodule GroupherServer.CMS.ArticleStats do
  @moduledoc """
  Owns field-scoped writes and consistent public reads for ArticleStats.

      Publish       -> initialize
      ViewTracker   -> increment_views
      Comments      -> apply_comment_counts
      Interactions  -> apply_interaction_counts
                         + apply_emotion_count
                              |
                              v
                  cms.article_stats
                  cms.article_emotion_counts

  Both projections use the stable Article identity `{thread, article_id}`.
  Public reads aggregate them in one PostgreSQL query.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.{Matcher, Threads}
  alias CMS.Articles.Bindings
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.FrontDesk

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleEmotionCount,
    ArticleStats,
    Comment,
    CommentLifecycle,
    Community
  }

  @article_threads Threads.article_enums()
  @article_emotions CMS.Artiment.Config.emotions() -- [:upvote, :collect]
  @conflict_target [:thread, :article_id]

  @doc """
  Reads one fully located public ArticleStats result for a canonical Article.

  This is the shared post-commit read contract used by owning command result
  builders. It preserves the revision and snapshot observed by ArticleStats and
  never synthesizes a missing projection row.
  """
  @spec for_article(struct(), Community.t()) :: {:ok, map()} | {:error, term()}
  def for_article(article, %Community{} = community) when is_struct(article) do
    with {:ok, %{community: community, inner_id: inner_id}} when is_integer(inner_id) <-
           Bindings.get(article, community),
         {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         stats when is_map(stats) <- for_public_articles(thread, [article], community.slug),
         {:ok, article_stats} <- Map.fetch(stats, {thread, article.id}) do
      {:ok,
       Map.merge(article_stats, %{
         community: community.slug,
         thread: thread,
         inner_id: inner_id
       })}
    else
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def for_article(_article, _community), do: {:error, :article_binding_context_required}

  @doc "Creates the zero-valued public row on first publish without overwriting an existing row."
  @spec initialize(struct()) :: {:ok, :pass} | {:error, term()}
  def initialize(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article) do
      Repo.insert_all(
        ArticleStats,
        [%{thread: thread, article_id: article.id}],
        on_conflict: :nothing,
        conflict_target: @conflict_target
      )

      {:ok, :pass}
    end
  end

  @doc "Atomically increments the ViewTracker-owned counter and returns the complete row."
  @spec increment_views(atom(), Ecto.UUID.t()) :: {:ok, map()} | {:error, term()}
  def increment_views(thread, article_id)
      when thread in @article_threads and is_binary(article_id) do
    conflict_query =
      from(stats in ArticleStats,
        update: [
          inc: [views: 1, views_revision: 1],
          set: [
            snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
            updated_at: fragment("date_trunc('second', clock_timestamp())")
          ]
        ]
      )

    case Repo.insert_all(
           ArticleStats,
           [%{thread: thread, article_id: article_id, views: 1, views_revision: 1}],
           on_conflict: conflict_query,
           conflict_target: @conflict_target,
           returning: true
         ) do
      {1, [_stats]} -> fetch(thread, article_id)
      _ -> {:error, :article_stats_not_updated}
    end
  end

  @doc "UPSERTs every Comments-owned ArticleStats field from one physical Article row."
  @spec apply_comment_counts(struct()) :: {:ok, :pass} | {:error, term()}
  def apply_comment_counts(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article),
         {:ok, comments_count} <- owner_count(article, :comments_count),
         {:ok, participants_count} <- owner_count(article, :comments_participants_count),
         {:ok, comments_revision} <- owner_count(article, :comments_revision) do
      conflict_query =
        from(stats in ArticleStats,
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
        ArticleStats,
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

      {:ok, :pass}
    end
  end

  @doc "Refreshes Comment-owned counts and atomically advances the public comments revision."
  @spec record_comment_change(Article.t()) :: {:ok, :pass} | {:error, term()}
  def record_comment_change(%Article{} = article) do
    with {:ok, comments_count} <- owner_count(article, :comments_count),
         {:ok, participants_count} <- owner_count(article, :comments_participants_count) do
      now = DateTime.utc_now(:second)

      conflict_query =
        from(stats in ArticleStats,
          update: [
            inc: [comments_revision: 1],
            set: [
              comments_count: ^comments_count,
              comments_participants_count: ^participants_count,
              snapshot_at: ^now,
              updated_at: ^now
            ]
          ]
        )

      Repo.insert_all(
        ArticleStats,
        [
          %{
            thread: article.thread,
            article_id: article.id,
            comments_count: comments_count,
            comments_participants_count: participants_count,
            comments_revision: 1,
            snapshot_at: now,
            inserted_at: now,
            updated_at: now
          }
        ],
        on_conflict: conflict_query,
        conflict_target: @conflict_target
      )

      {:ok, :pass}
    end
  end

  @doc "UPSERTs the fixed Interactions-owned fields from their owner projection."
  @spec apply_interaction_counts(struct()) :: {:ok, :pass} | {:error, term()}
  def apply_interaction_counts(article) when is_struct(article) do
    with {:ok, thread} <- article_thread(article),
         counts when is_map(counts) <- CMS.Interactions.counts([article]),
         {:ok, interaction} <- owner_facts(counts, {thread, article.id}),
         {:ok, upvotes_count} <- owner_count(interaction, :upvotes_count),
         {:ok, collects_count} <- owner_count(interaction, :collects_count),
         {:ok, interaction_revision} <- owner_count(interaction, :interaction_revision) do
      conflict_query =
        from(stats in ArticleStats,
          update: [
            set: [
              upvotes_count: ^upvotes_count,
              collects_count: ^collects_count,
              interaction_revision: ^interaction_revision,
              snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
              updated_at: fragment("date_trunc('second', clock_timestamp())")
            ]
          ]
        )

      Repo.insert_all(
        ArticleStats,
        [
          %{
            thread: thread,
            article_id: article.id,
            upvotes_count: upvotes_count,
            collects_count: collects_count,
            interaction_revision: interaction_revision
          }
        ],
        on_conflict: conflict_query,
        conflict_target: @conflict_target
      )

      {:ok, :pass}
    end
  end

  @doc "UPSERTs only the affected Interactions-owned emotion type."
  @spec apply_emotion_count(struct(), atom()) :: {:ok, :pass} | {:error, term()}
  def apply_emotion_count(article, emotion)
      when is_struct(article) and emotion in @article_emotions do
    with {:ok, thread} <- article_thread(article),
         {:ok, owner} <- emotion_owner_facts(article, emotion) do
      now = DateTime.utc_now(:second)

      attrs = %{
        thread: thread,
        article_id: article.id,
        type: emotion,
        count: owner.count
      }

      %ArticleEmotionCount{}
      |> ArticleEmotionCount.changeset(attrs)
      |> Repo.insert(
        on_conflict: [
          set: [
            count: owner.count,
            updated_at: now
          ]
        ],
        conflict_target: [:thread, :article_id, :type]
      )
      |> case do
        {:ok, _row} -> {:ok, :pass}
        {:error, _reason} = error -> error
      end
    end
  end

  def apply_emotion_count(_article, emotion), do: {:error, {:unsupported_emotion, emotion}}

  @doc "Repairs only Comments-owned fields from the current physical Article row."
  @spec rebuild_comment_fields(struct()) :: {:ok, :pass} | {:error, term()}
  def rebuild_comment_fields(%Article{id: article_id}) do
    Repo.transaction(fn ->
      current =
        Article
        |> where([article], article.id == ^article_id)
        |> lock("FOR UPDATE")
        |> Repo.one()

      case current do
        %Article{} -> record_comment_change(current)
        nil -> Repo.rollback(:article_not_found)
      end
    end)
    |> transaction_result()
  end

  def rebuild_comment_fields(article) when is_struct(article) do
    schema = article.__struct__

    Repo.transaction(fn ->
      current =
        from(item in schema, where: item.id == ^article.id, lock: "FOR UPDATE")
        |> Repo.one()

      with %{} = current <- current,
           {:ok, current} <-
             current
             |> Ecto.Changeset.change(comments_revision: current.comments_revision + 1)
             |> Repo.update(),
           {:ok, _} <- apply_comment_counts(current) do
        {:ok, :pass}
      else
        nil -> Repo.rollback(:article_not_found)
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> transaction_result()
  end

  @doc "Repairs fixed and typed Interactions-owned fields from current owner facts."
  @spec rebuild_interaction_fields(struct()) :: {:ok, :pass} | {:error, term()}
  def rebuild_interaction_fields(article) when is_struct(article) do
    schema = article.__struct__

    Repo.transaction(fn ->
      current =
        from(item in schema, where: item.id == ^article.id, lock: "FOR UPDATE")
        |> Repo.one()

      with %{} = current <- current,
           {:ok, _} <- bump_interaction_owner_revision(current),
           {:ok, _} <- apply_interaction_counts(current),
           counts when is_map(counts) <- CMS.Interactions.counts([current]),
           {:ok, thread} <- article_thread(current),
           {:ok, facts} <- owner_facts(counts, {thread, current.id}),
           {:ok, _} <- rebuild_emotion_rows(current, thread, Map.get(facts, :emotion_counts, [])) do
        {:ok, :pass}
      else
        nil -> Repo.rollback(:article_not_found)
        {:error, reason} -> Repo.rollback(reason)
        reason -> Repo.rollback(reason)
      end
    end)
    |> transaction_result()
  end

  @doc "Removes both public projections during permanent Article deletion."
  @spec delete(atom(), Ecto.UUID.t()) :: {:ok, :pass}
  def delete(thread, article_id)
      when thread in @article_threads and is_binary(article_id) do
    Repo.delete_all(
      from(emotion in ArticleEmotionCount,
        where: emotion.thread == ^thread and emotion.article_id == ^article_id
      )
    )

    Repo.delete_all(
      from(stats in ArticleStats,
        where: stats.thread == ^thread and stats.article_id == ^article_id
      )
    )

    {:ok, :pass}
  end

  @doc "Returns one complete row by stable Article identity."
  @spec fetch(atom(), Ecto.UUID.t()) :: {:ok, map()} | {:error, :article_stats_not_found}
  def fetch(thread, article_id) when thread in @article_threads and is_binary(article_id) do
    case Map.get(load_snapshots(thread, [article_id]), article_id) do
      nil -> {:error, :article_stats_not_found}
      stats -> {:ok, stats}
    end
  end

  @doc "Returns projection rows keyed by `{thread, article_id}`."
  @spec for_articles(atom(), [struct()]) :: map()
  def for_articles(thread, articles) when thread in @article_threads and is_list(articles) do
    ids = Enum.map(articles, & &1.id)

    thread
    |> load_snapshots(ids)
    |> Map.new(fn {article_id, stats} -> {{thread, article_id}, stats} end)
  end

  @doc "Reads public ArticleStats for one Community/thread batch."
  @spec read_public(String.t(), atom(), [String.t() | integer()]) ::
          {:ok, [map()]} | {:error, term()}
  def read_public(community_ref, thread, inner_ids)
      when is_binary(community_ref) and is_atom(thread) and is_list(inner_ids) do
    with {:ok, inner_ids} <- normalize_inner_ids(inner_ids),
         {:ok, stats} <- read_public_batch(community_ref, thread, inner_ids) do
      {:ok, stats}
    else
      {:error, _} = error -> error
    end
  end

  @doc "Builds ArticleStats for Articles already authorized by their caller's scope."
  @spec for_public_articles(atom(), [struct()], String.t() | nil) ::
          %{optional({atom(), integer()}) => map()} | {:error, term()}
  def for_public_articles(thread, articles, community_ref \\ nil)
      when is_atom(thread) and is_list(articles) do
    articles = preload_stats_communities(articles, community_ref)
    stats_by_article_id = for_articles(thread, articles)

    with {:ok, _} <- ensure_stats_rows(articles, stats_by_article_id, thread) do
      Map.new(articles, fn article ->
        stats = Map.fetch!(stats_by_article_id, {thread, article.id})
        community = community_ref || article_binding_slug(article)

        {{thread, article.id}, Map.put(stats, :community, community)}
      end)
    end
  end

  defp read_public_batch(_community_ref, _thread, []), do: {:ok, []}

  defp read_public_batch(community_ref, thread, inner_ids) do
    case FrontDesk.community(community_ref) do
      {:ok, %Community{id: community_id}} ->
        rows =
          Article
          |> join(:inner, [article], binding in ArticleBinding,
            on: binding.article_id == article.id and binding.visible == true
          )
          |> where(
            [article, binding],
            article.thread == ^thread and binding.community_id == ^community_id and
              binding.inner_id in ^inner_ids
          )
          |> select([article, binding], %{article: article, inner_id: binding.inner_id})
          |> Repo.all()

        articles = Enum.map(rows, & &1.article)
        stats_by_article_id = for_articles(thread, articles)

        with {:ok, _} <- ensure_stats_rows(articles, stats_by_article_id, thread) do
          stats_by_inner_id =
            Map.new(rows, fn %{article: article, inner_id: inner_id} ->
              stats = Map.fetch!(stats_by_article_id, {thread, article.id})

              {to_string(inner_id),
               Map.merge(stats, %{
                 community: community_ref,
                 thread: thread,
                 inner_id: inner_id
               })}
            end)

          {:ok,
           Enum.flat_map(inner_ids, fn inner_id ->
             case Map.fetch(stats_by_inner_id, to_string(inner_id)) do
               {:ok, stats} -> [stats]
               :error -> []
             end
           end)}
        end

      {:error, _} = error ->
        error
    end
  end

  defp normalize_inner_ids(inner_ids) do
    normalized =
      Enum.reduce_while(inner_ids, {:ok, []}, fn value, {:ok, acc} ->
        case Integer.parse(to_string(value)) do
          {id, ""} when id > 0 -> {:cont, {:ok, [id | acc]}}
          _ -> {:halt, :error}
        end
      end)

    case normalized do
      {:ok, ids} ->
        ids = ids |> Enum.uniq() |> Enum.reverse()

        if length(ids) <= 100 do
          {:ok, ids}
        else
          {:error, ArticleErrorCat.article_not_found("too many article ids")}
        end

      :error ->
        {:error, ArticleErrorCat.article_not_found("invalid article ids")}
    end
  end

  defp ensure_stats_rows(articles, stats_by_article_id, thread) do
    if Enum.all?(articles, &Map.has_key?(stats_by_article_id, {thread, &1.id})) do
      {:ok, :pass}
    else
      {:error, ArticleErrorCat.projection_not_updated()}
    end
  end

  defp article_binding_slug(article) do
    case Bindings.get(article, Map.get(article, :community)) do
      {:ok, %{community: community}} -> community.slug
      _ -> nil
    end
  end

  defp preload_stats_communities(articles, community_ref) when is_binary(community_ref) do
    articles
  end

  defp preload_stats_communities(articles, _community_ref) do
    articles
  end

  defp load_snapshots(_thread, []), do: %{}

  defp load_snapshots(thread, article_ids) do
    emotion_rows =
      from(emotion in ArticleEmotionCount,
        where:
          emotion.thread == ^thread and emotion.article_id in ^article_ids and emotion.count > 0,
        group_by: emotion.article_id,
        select: %{
          article_id: emotion.article_id,
          emotion_counts:
            fragment(
              "jsonb_agg(jsonb_build_object('type', ?, 'count', ?) ORDER BY ? DESC, ? ASC)",
              emotion.type,
              emotion.count,
              emotion.count,
              emotion.type
            )
        }
      )

    from(stats in ArticleStats,
      where: stats.thread == ^thread and stats.article_id in ^article_ids,
      left_join: emotions in subquery(emotion_rows),
      on: emotions.article_id == stats.article_id,
      select: %{
        stats: stats,
        emotion_counts: fragment("COALESCE(?, '[]'::jsonb)", emotions.emotion_counts)
      }
    )
    |> Repo.all()
    |> Map.new(fn %{stats: stats, emotion_counts: emotion_counts} ->
      {stats.article_id, normalize(stats, emotion_counts)}
    end)
  end

  defp article_thread(article) do
    with {:ok, %{artiment: thread}} <- Matcher.match_interaction(article),
         true <- thread in @article_threads do
      {:ok, thread}
    else
      false -> {:error, :unsupported_article_thread}
      {:error, _reason} = error -> error
    end
  end

  defp normalize(%ArticleStats{} = stats, emotion_counts) do
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
      emotion_counts: normalize_emotion_counts(emotion_counts),
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
           emotion_counts: []
         }}

      _ ->
        {:error, {:invalid_owner_facts, identity}}
    end
  end

  defp owner_count(%Article{id: article_id}, :comments_count) do
    {:ok,
     Repo.aggregate(
       from(comment in Comment,
         join: lifecycle in CommentLifecycle,
         on: lifecycle.comment_id == comment.id,
         where: comment.article_id == ^article_id and lifecycle.state == :visible
       ),
       :count
     )}
  end

  defp owner_count(%Article{id: article_id}, :comments_participants_count) do
    count =
      from(comment in Comment,
        join: lifecycle in CommentLifecycle,
        on: lifecycle.comment_id == comment.id,
        where: comment.article_id == ^article_id and lifecycle.state == :visible,
        select: count(comment.author_id, :distinct)
      )
      |> Repo.one()

    {:ok, count}
  end

  defp owner_count(%Article{id: article_id}, :comments_revision) do
    count =
      Repo.aggregate(from(comment in Comment, where: comment.article_id == ^article_id), :count)

    {:ok, count}
  end

  defp owner_count(owner, field) do
    case Map.fetch(owner, field) do
      {:ok, value} when is_integer(value) and value >= 0 -> {:ok, value}
      _ -> {:error, {:invalid_owner_count, field}}
    end
  end

  defp bump_interaction_owner_revision(article) do
    with {:ok, info} <- Matcher.match_interaction(article) do
      now = DateTime.utc_now(:second)
      foreign_key = info.foreign_key

      Repo.insert_all(
        info.reaction_info_model,
        [%{foreign_key => article.id, inserted_at: now, updated_at: now}],
        on_conflict: :nothing,
        conflict_target: interaction_projection_conflict_target(foreign_key)
      )

      from(owner in info.reaction_info_model,
        where: field(owner, ^foreign_key) == ^article.id
      )
      |> Repo.update_all(inc: [interaction_revision: 1], set: [updated_at: now])
      |> case do
        {1, _} -> {:ok, :pass}
        _ -> {:error, :interaction_projection_not_updated}
      end
    end
  end

  defp interaction_projection_conflict_target(:article_id) do
    {:unsafe_fragment, "(article_id) WHERE article_id IS NOT NULL AND branch_id IS NULL"}
  end

  defp interaction_projection_conflict_target(foreign_key), do: [foreign_key]

  defp transaction_result({:ok, {:ok, _value}}), do: {:ok, :pass}
  defp transaction_result({:error, reason}), do: {:error, reason}

  defp emotion_owner_facts(article, emotion) do
    with {:ok, info} <- Matcher.match_interaction(article) do
      emotion_name = Atom.to_string(emotion)
      foreign_key = info.foreign_key

      from(reaction in info.reaction_info_model,
        left_join: emotion_row in ^info.emotion_info_model,
        on:
          field(emotion_row, ^foreign_key) == field(reaction, ^foreign_key) and
            emotion_row.emotion == ^emotion_name,
        where: field(reaction, ^foreign_key) == ^article.id,
        select: %{count: coalesce(emotion_row.users_count, 0)}
      )
      |> Repo.one()
      |> case do
        %{count: count} when is_integer(count) and count >= 0 ->
          {:ok, %{count: count}}

        nil ->
          {:error, :interaction_projection_not_found}

        _ ->
          {:error, :invalid_interaction_projection}
      end
    end
  end

  defp rebuild_emotion_rows(article, thread, emotion_counts) when is_list(emotion_counts) do
    Repo.delete_all(
      from(emotion in ArticleEmotionCount,
        where: emotion.thread == ^thread and emotion.article_id == ^article.id
      )
    )

    emotion_counts
    |> Enum.map(&(Map.get(&1, :type) || Map.get(&1, "type")))
    |> Enum.filter(&(&1 in @article_emotions))
    |> Enum.reduce_while({:ok, :pass}, fn emotion, {:ok, _} ->
      case apply_emotion_count(article, emotion) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp normalize_emotion_counts(counts) when is_list(counts) do
    counts
    |> Enum.map(fn count ->
      type = Map.get(count, "type") || Map.get(count, :type)
      value = Map.get(count, "count") || Map.get(count, :count)

      %{type: atomize_emotion(type), count: normalize_non_negative(value)}
    end)
    |> Enum.reject(&is_nil(&1.type))
  end

  defp normalize_emotion_counts(_counts), do: []

  defp normalize_non_negative(value) when is_integer(value) and value >= 0, do: value
  defp normalize_non_negative(_value), do: 0

  defp atomize_emotion(value) when is_atom(value), do: if(value in @article_emotions, do: value)

  defp atomize_emotion(value) when is_binary(value) do
    Enum.find(@article_emotions, &(Atom.to_string(&1) == value))
  end

  defp atomize_emotion(_value), do: nil
end
