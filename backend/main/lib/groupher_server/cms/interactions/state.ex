defmodule GroupherServer.CMS.Interactions.State do
  @moduledoc """
  Public read/write boundary for Artiment interaction projections.

  Fact-table writes call this module in the same transaction. It owns the
  transaction-local projection update and locks only the corresponding reaction
  or emotion info row, never the article/comment row.

  Business position:

      CMS fact context / list -> Interactions.State -> projection row
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User

  alias CMS.{FrontDesk, ShadowSync}
  alias CMS.Interactions.{Config, Registry, RoaringBitmap}

  alias CMS.Model.{
    Comment,
    CommentReactionInfo,
    Embeds,
    ViewEvent
  }

  require RoaringBitmap

  @type fixed_reaction :: :collect | :report | :upvote | :view
  @type operation :: :add | :remove

  @doc "Reads materialized fixed-reaction counts keyed by physical target id."
  @spec counts(:comment | :post | :blog | :changelog | :doc, [integer()]) :: %{integer() => map()}
  def counts(:comment, target_ids), do: fixed_counts(:comment, target_ids)
  def counts(thread, target_ids), do: fixed_counts(thread, target_ids)

  @doc "Updates a projection after the owning fact mutation succeeds."
  @spec write(term(), :collect | :report | :upvote | {:emotion, atom()}, User.t(), operation()) ::
          {:ok, map()} | {:error, term()}
  def write(target, {:emotion, emotion}, %User{} = user, operation)
      when operation in [:add, :remove] do
    case target do
      %Comment{} -> sync_comment_emotion(target, emotion, user, operation)
      _ -> sync_article_emotion(target, emotion, user, operation)
    end
  end

  def write(%Comment{} = comment, reaction, %User{} = user, operation)
      when reaction in [:report, :upvote] and operation in [:add, :remove],
      do: sync_comment_fixed(comment, reaction, user, operation)

  def write(article, reaction, %User{} = user, operation)
      when reaction in [:collect, :report, :upvote] and operation in [:add, :remove],
      do: sync_article_fixed(article, reaction, user, operation)

  @doc "Merges asynchronously projected view viewers; views do not use write/4."
  @spec merge_viewed_users(:post | :blog | :changelog | :doc, integer(), [integer()]) :: :ok
  def merge_viewed_users(thread, target_id, user_ids),
    do: project_article_views(thread, target_id, user_ids)

  @doc "Adds projection-backed interaction ordering before article pagination."
  @spec order_articles(Ecto.Queryable.t(), :post | :blog | :changelog | :doc, atom() | nil) ::
          Ecto.Queryable.t()
  def order_articles(queryable, _thread, order) when order in [nil, :publish, :comments, :views],
    do: queryable

  def order_articles(queryable, thread, :upvotes),
    do: order_articles_by_count(queryable, thread, :upvotes_count)

  def order_articles(queryable, thread, :collects),
    do: order_articles_by_count(queryable, thread, :collects_count)

  def order_articles(queryable, _thread, _order), do: queryable

  defp order_articles_by_count(queryable, thread, count_field) do
    info = Registry.target(thread)
    schema = info.reaction
    target_id = info.target_id

    from(article in queryable,
      left_join: info in ^schema,
      on: field(info, ^target_id) == article.id,
      order_by: [
        desc_nulls_last: field(info, ^count_field),
        desc_nulls_last: article.id
      ]
    )
  end

  @doc "Reads and merges interaction state for a list of articles or comments."
  @spec read(:comment | :post | :blog | :changelog | :doc, [term()], User.t() | nil, keyword()) ::
          [term()]
  def read(:comment, entries, viewer, opts) when is_list(entries) do
    entries
    |> read_comments(viewer, opts)
    |> ShadowSync.refresh_comments()
  end

  def read(thread, entries, viewer, opts)
      when thread in [:post, :blog, :changelog, :doc] and is_list(entries) do
    pending_viewed_ids =
      case viewer do
        %User{id: user_id} -> pending_viewed_ids(thread, Enum.map(entries, & &1.id), user_id)
        _ -> MapSet.new()
      end

    entries
    |> read_articles(viewer, opts)
    |> Enum.map(fn entry ->
      if MapSet.member?(pending_viewed_ids, entry.id),
        do: Map.put(entry, :viewer_has_viewed, true),
        else: entry
    end)
    |> ShadowSync.refresh_articles()
  end

  @doc "Reads and merges interaction state for one article or comment."
  @spec read(term(), User.t() | nil, keyword()) :: term()
  def read(target, viewer \\ nil, opts \\ []) do
    with {:ok, thread} <- FrontDesk.thread_of(target) do
      opts = comment_context_opts(target, opts)
      read_thread = if match?(%Comment{}, target), do: :comment, else: thread
      target |> then(&read(read_thread, [&1], viewer, opts)) |> List.first(target)
    else
      _ -> target
    end
  end

  defp comment_context_opts(%Comment{} = comment, opts) do
    if Keyword.has_key?(opts, :article_author_id) do
      opts
    else
      with {:ok, article} <- FrontDesk.article_of(comment),
           {:ok, %User{id: author_id}} <- FrontDesk.author_of(article),
           do: Keyword.put(opts, :article_author_id, author_id),
           else: (_ -> opts)
    end
  end

  defp comment_context_opts(_target, opts), do: opts

  @doc "Synchronizes a fixed article reaction after its fact row changes."
  @spec sync_article_fixed(term(), fixed_reaction(), User.t(), operation()) ::
          {:ok, map()} | {:error, term()}
  def sync_article_fixed(article, reaction, %User{} = user, operation)
      when reaction in [:collect, :report, :upvote, :view] and operation in [:add, :remove] do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      sync_fixed(Registry.target(thread), article.id, reaction, user, operation)
    end
  end

  @doc "Merges a batch of article viewers into the asynchronous view projection."
  @spec project_article_views(atom(), integer(), [integer()]) :: :ok | {:error, term()}
  def project_article_views(thread, target_id, user_ids)
      when thread in [:post, :blog, :changelog, :doc] and is_list(user_ids) do
    info = Registry.target(thread)
    reaction_info = lock_reaction_info(info, target_id)

    from(info in info.reaction, where: info.id == ^reaction_info.id)
    |> update(
      [info],
      set: [
        viewed_user_ids: RoaringBitmap.merge(info.viewed_user_ids, ^user_ids),
        updated_at: ^DateTime.utc_now(:second)
      ]
    )
    |> Repo.update_all([])

    :ok
  end

  @doc "Synchronizes a fixed comment reaction after its fact row changes."
  @spec sync_comment_fixed(term(), :report | :upvote | :view, User.t(), operation()) ::
          {:ok, map()} | {:error, term()}
  def sync_comment_fixed(comment, reaction, %User{} = user, operation)
      when reaction in [:report, :upvote, :view] and operation in [:add, :remove] do
    sync_fixed(Registry.target(:comment), comment.id, reaction, user, operation)
  end

  @doc "Synchronizes one article emotion projection after its fact row changes."
  @spec sync_article_emotion(term(), atom(), User.t(), operation()) ::
          {:ok, map()} | {:error, term()}
  def sync_article_emotion(article, emotion, %User{} = user, operation)
      when is_atom(emotion) and operation in [:add, :remove] do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      sync_emotion(Registry.target(thread), article.id, emotion, user, operation)
    end
  end

  @doc "Synchronizes one comment emotion projection after its fact row changes."
  @spec sync_comment_emotion(term(), atom(), User.t(), operation()) ::
          {:ok, map()} | {:error, term()}
  def sync_comment_emotion(comment, emotion, %User{} = user, operation)
      when is_atom(emotion) and operation in [:add, :remove] do
    sync_emotion(Registry.target(:comment), comment.id, emotion, user, operation)
  end

  @doc "Returns materialized fixed-reaction counts keyed by physical target id."
  @spec fixed_counts(:comment | :post | :blog | :changelog | :doc, [integer()]) :: %{
          integer() => map()
        }
  def fixed_counts(:comment, target_ids), do: fixed_counts_for(Registry.target(:comment), target_ids)

  def fixed_counts(thread, target_ids) when thread in [:post, :blog, :changelog, :doc],
    do: fixed_counts_for(Registry.target(thread), target_ids)

  @doc "Returns durable, not-yet-projected view targets for one viewer."
  @spec pending_viewed_ids(:post | :blog | :changelog | :doc, [integer()], integer()) ::
          MapSet.t()
  def pending_viewed_ids(thread, target_ids, user_id)
      when thread in [:post, :blog, :changelog, :doc] and is_integer(user_id) do
    from(event in ViewEvent,
      where:
        event.target_type == ^thread and event.target_id in ^Enum.uniq(target_ids) and
          event.user_id == ^user_id and is_nil(event.processed_at),
      select: event.target_id
    )
    |> Repo.all()
    |> MapSet.new()
  end

  defp fixed_counts_for(info, target_ids) do
    target_ids = Enum.uniq(target_ids)

    if target_ids == [] do
      %{}
    else
      query =
        from(info_row in info.reaction,
          where: field(info_row, ^info.target_id) in ^target_ids,
          select: %{
            target_id: field(info_row, ^info.target_id),
            upvotes_count: info_row.upvotes_count
          }
        )

      query =
        if Map.get(info, :collection?, false) do
          select_merge(query, [info_row], %{collects_count: info_row.collects_count})
        else
          query
        end

      query
      |> Repo.all()
      |> Map.new(fn row -> {row.target_id, row} end)
    end
  end

  defp read_articles(articles, user, opts) when is_list(articles) do
    hydrated_by_target =
      articles
      |> Enum.group_by(fn article ->
        case FrontDesk.thread_of(article) do
          {:ok, thread} -> thread
          _ -> nil
        end
      end)
      |> Enum.flat_map(fn
        {nil, items} ->
          Enum.map(items, &{{nil, &1.id}, &1})

        {thread, items} ->
          items
          |> merge_article_states(Registry.target(thread), user, opts)
          |> Enum.map(&{{thread, &1.id}, &1})
      end)
      |> Map.new()

    articles
    |> Enum.map(fn article ->
      key =
        case FrontDesk.thread_of(article) do
          {:ok, thread} -> {thread, article.id}
          _ -> {nil, article.id}
        end

      Map.get(hydrated_by_target, key, article)
    end)
  end

  defp read_comments(comments, user, opts) when is_list(comments) do
    all_comments =
      comments
      |> Enum.flat_map(fn comment -> [comment | embedded_replies(comment)] end)
      |> Enum.uniq_by(& &1.id)

    author_upvoted_ids =
      comment_ids_upvoted_by_article_author(
        Enum.map(all_comments, & &1.id),
        Keyword.get(opts, :article_author_id)
      )

    # Embedded replies are lightweight copies of rows that may also be present
    # as top-level entries. Build their projection states together, then let
    # the top-level entries win so their preloaded associations are preserved.
    hydrated_by_id =
      all_comments
      |> merge_comment_states(Registry.target(:comment), user, author_upvoted_ids, opts)
      |> Map.new(&{&1.id, &1})

    top_level_by_id = Map.new(comments, &{&1.id, &1})

    by_id =
      Enum.reduce(hydrated_by_id, %{}, fn {id, hydrated}, acc ->
        case Map.get(top_level_by_id, id) do
          nil ->
            Map.put(acc, id, hydrated)

          top_level ->
            Map.put(acc, id, preserve_loaded_associations(top_level, hydrated))
        end
      end)

    comments
    |> Enum.map(fn comment ->
      hydrated = Map.fetch!(by_id, comment.id)

      replies =
        comment
        |> embedded_replies()
        |> Enum.map(&Map.get(by_id, &1.id, &1))

      Map.put(hydrated, :replies, replies)
    end)
  end

  defp preserve_loaded_associations(top_level, hydrated) do
    Map.merge(top_level, hydrated, fn _key, top_value, hydrated_value ->
      if association_not_loaded?(hydrated_value), do: top_value, else: hydrated_value
    end)
  end

  defp association_not_loaded?(%Ecto.Association.NotLoaded{}), do: true
  defp association_not_loaded?(_value), do: false

  defp sync_fixed(info, target_id, reaction, user, operation) do
    bitmap_field = bitmap_field(reaction)
    latest_field = latest_field(reaction)
    count_field = count_field(reaction)
    reaction_info = lock_reaction_info(info, target_id)

    latest_users =
      case latest_field do
        nil -> nil
        field -> next_latest_users(Map.get(reaction_info, field, []), user, operation)
      end

    with :ok <-
           update_projection!(
             info.reaction,
             reaction_info.id,
             bitmap_field,
             user.id,
             operation,
             count_field,
             latest_field,
             latest_users
           ) do
      {:ok, reaction_info}
    end
  end

  defp sync_emotion(info, target_id, emotion, user, operation) do
    emotion_info = lock_emotion_info(info, target_id, emotion)
    latest_users = next_latest_users(emotion_info.latest_users, user, operation)

    with :ok <-
           update_projection!(
             info.emotion,
             emotion_info.id,
             :user_ids,
             user.id,
             operation,
             :users_count,
             :latest_users,
             latest_users
           ) do
      {:ok, emotion_info}
    end
  end

  defp merge_article_states(articles, info, user, opts) do
    fixed_by_target = fixed_stats_by_target(info, Enum.map(articles, & &1.id), user, opts)
    emotions_by_target = emotion_stats_by_target(info, Enum.map(articles, & &1.id), user, :article)

    Enum.map(articles, fn article ->
      fixed = Map.get(fixed_by_target, article.id, empty_reaction_state(info))

      article
      |> Map.merge(fixed)
      |> Map.put(:meta, article_meta(article.meta, fixed))
      |> Map.put(
        :emotions,
        Map.merge(article_default_emotions(), Map.get(emotions_by_target, article.id, %{}))
      )
    end)
  end

  defp merge_comment_states(comments, info, user, author_upvoted_ids, opts) do
    fixed_by_target = fixed_stats_by_target(info, Enum.map(comments, & &1.id), user, opts)
    emotions_by_target = emotion_stats_by_target(info, Enum.map(comments, & &1.id), user, :comment)

    Enum.map(comments, fn comment ->
      fixed = Map.get(fixed_by_target, comment.id, empty_reaction_state(info))

      comment
      |> Map.merge(fixed)
      |> Map.put(:meta, comment_meta(comment, fixed, author_upvoted_ids))
      |> Map.put(
        :emotions,
        Map.merge(comment_default_emotions(), Map.get(emotions_by_target, comment.id, %{}))
      )
    end)
  end

  defp fixed_stats_by_target(info, target_ids, user, opts) do
    target_id_field = info.target_id
    user_id = if match?(%User{}, user), do: user.id

    query =
      from(info_row in info.reaction,
        where: field(info_row, ^target_id_field) in ^target_ids,
        select: %{
          target_id: field(info_row, ^target_id_field),
          latest_upvoted_users: info_row.latest_upvoted_users,
          upvotes_count: info_row.upvotes_count
        }
      )

    query =
      if Keyword.get(opts, :surface) == :report do
        select_merge(query, [info_row], %{
          reported_count: RoaringBitmap.cardinality(info_row.reported_user_ids)
        })
      else
        query
      end

    query
    |> select_fixed_viewer_state(user_id)
    |> maybe_select_collection_stats(info, user_id)
    |> Repo.all()
    |> Map.new(fn fixed ->
      {fixed.target_id, Map.merge(empty_reaction_state(info), fixed)}
    end)
  end

  defp emotion_stats_by_target(
         %{emotion: schema, target_id: target_id_field},
         target_ids,
         user,
         emotion_kind
       ) do
    user_id = if match?(%User{}, user), do: user.id

    from(info in schema,
      where: field(info, ^target_id_field) in ^target_ids,
      select: %{
        target_id: field(info, ^target_id_field),
        emotion: info.emotion,
        latest_users: info.latest_users,
        count: info.users_count
      }
    )
    |> select_emotion_viewer_state(user_id)
    |> Repo.all()
    |> Enum.group_by(& &1.target_id)
    |> Map.new(fn {target_id, rows} ->
      emotions = Enum.reduce(rows, %{}, &Map.merge(&2, emotion_embed(&1, emotion_kind)))
      {target_id, emotions}
    end)
  end

  defp emotion_embed(row, emotion_kind) do
    case Registry.decode_emotion(row.emotion, emotion_kind) do
      {:ok, emotion} ->
        %{
          :"#{emotion}_count" => row.count,
          :"latest_#{emotion}_users" => row.latest_users,
          :"viewer_has_#{emotion}ed" => Map.get(row, :viewer_has_reacted, false)
        }

      {:error, :unknown_emotion} ->
        :telemetry.execute([:groupher, :cms, :interactions, :unknown_emotion], %{count: 1}, %{
          emotion: row.emotion,
          kind: emotion_kind
        })

        %{}
    end
  end

  defp article_default_emotions, do: Embeds.ArticleEmotion.default_emotions()
  defp comment_default_emotions, do: Embeds.CommentEmotion.default_emotions()

  defp article_meta(meta, fixed) do
    (meta || %{})
    |> Map.put(:latest_upvoted_users, fixed.latest_upvoted_users)
    |> Map.put(:latest_collected_users, fixed.latest_collected_users)
    |> Map.put(:reported_count, Map.get(fixed, :reported_count, 0))
  end

  defp comment_meta(comment, fixed, author_upvoted_ids),
    do:
      (comment.meta || %{})
      |> Map.put(:latest_upvoted_users, fixed.latest_upvoted_users)
      |> Map.put(:reported_count, Map.get(fixed, :reported_count, 0))
      |> Map.put(:is_article_author_upvoted, MapSet.member?(author_upvoted_ids, comment.id))

  defp comment_ids_upvoted_by_article_author(_comment_ids, nil), do: MapSet.new()

  defp comment_ids_upvoted_by_article_author(comment_ids, author_id) do
    from(info in CommentReactionInfo,
      where: info.comment_id in ^Enum.uniq(comment_ids),
      where:
        fragment(
          "COALESCE(?, '{}'::roaringbitmap64) @> ?::bigint",
          info.upvoted_user_ids,
          ^author_id
        ),
      select: info.comment_id
    )
    |> Repo.all()
    |> MapSet.new()
  end

  defp empty_reaction_state(%{collection?: true}) do
    %{
      collects_count: 0,
      latest_collected_users: [],
      latest_upvoted_users: [],
      upvotes_count: 0,
      viewer_has_collected: false,
      viewer_has_reported: false,
      viewer_has_upvoted: false,
      viewer_has_viewed: false
    }
  end

  defp empty_reaction_state(_info) do
    %{
      latest_upvoted_users: [],
      upvotes_count: 0,
      viewer_has_reported: false,
      viewer_has_upvoted: false,
      viewer_has_viewed: false
    }
  end

  defp lock_reaction_info(
         %{reaction: schema, target_id: target_id_field} = reaction_info,
         target_id
       ) do
    insert_info(schema, target_id_field, target_id)

    query =
      from(info in schema,
        where: field(info, ^target_id_field) == ^target_id,
        lock: "FOR UPDATE",
        select: %{id: info.id, latest_upvoted_users: info.latest_upvoted_users}
      )

    if Map.get(reaction_info, :collection?, false) do
      select_merge(query, [info], %{latest_collected_users: info.latest_collected_users})
    else
      query
    end
    |> Repo.one!()
  end

  defp lock_emotion_info(%{emotion: schema, target_id: target_id_field}, target_id, emotion) do
    insert_emotion_info(schema, target_id_field, target_id, emotion)

    from(info in schema,
      where: field(info, ^target_id_field) == ^target_id and info.emotion == ^to_string(emotion),
      lock: "FOR UPDATE",
      select: %{id: info.id, latest_users: info.latest_users}
    )
    |> Repo.one!()
  end

  defp insert_info(schema, target_id_field, target_id) do
    now = DateTime.utc_now(:second)

    Repo.insert_all(
      schema,
      [%{target_id_field => target_id, inserted_at: now, updated_at: now}],
      on_conflict: :nothing,
      conflict_target: [target_id_field]
    )
  end

  defp insert_emotion_info(schema, target_id_field, target_id, emotion) do
    now = DateTime.utc_now(:second)

    Repo.insert_all(
      schema,
      [
        %{
          target_id_field => target_id,
          emotion: to_string(emotion),
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict: :nothing,
      conflict_target: [target_id_field, :emotion]
    )
  end

  defp update_projection!(
         schema,
         info_id,
         bitmap_field,
         user_id,
         operation,
         count_field,
         latest_field,
         latest_users
       ) do
    bitmap =
      case operation do
        :add -> dynamic([info], RoaringBitmap.add(field(info, ^bitmap_field), ^user_id))
        :remove -> dynamic([info], RoaringBitmap.remove(field(info, ^bitmap_field), ^user_id))
      end

    set = [{bitmap_field, bitmap}, {:updated_at, DateTime.utc_now(:second)}]
    set = maybe_put_latest(set, latest_field, latest_users)
    updates = [set: set]

    updates =
      case count_field do
        nil -> updates
        field -> Keyword.put(updates, :inc, [{field, if(operation == :add, do: 1, else: -1)}])
      end

    case from(info in schema, where: info.id == ^info_id) |> Repo.update_all(updates) do
      {1, _} -> :ok
      {0, _} -> {:error, :projection_not_updated}
    end
  end

  defp latest_field(:upvote), do: :latest_upvoted_users
  defp latest_field(:collect), do: :latest_collected_users
  defp latest_field(_reaction), do: nil

  defp bitmap_field(:collect), do: :collected_user_ids
  defp bitmap_field(:report), do: :reported_user_ids
  defp bitmap_field(:upvote), do: :upvoted_user_ids
  defp bitmap_field(:view), do: :viewed_user_ids

  defp count_field(:upvote), do: :upvotes_count
  defp count_field(:collect), do: :collects_count
  defp count_field(_reaction), do: nil

  defp select_fixed_viewer_state(query, nil) do
    select_merge(query, %{
      viewer_has_reported: false,
      viewer_has_upvoted: false,
      viewer_has_viewed: false
    })
  end

  defp select_fixed_viewer_state(query, user_id) do
    select_merge(query, [info], %{
      viewer_has_reported: RoaringBitmap.contains(info.reported_user_ids, ^user_id),
      viewer_has_upvoted: RoaringBitmap.contains(info.upvoted_user_ids, ^user_id),
      viewer_has_viewed: RoaringBitmap.contains(info.viewed_user_ids, ^user_id)
    })
  end

  defp select_emotion_viewer_state(query, nil),
    do: select_merge(query, %{viewer_has_reacted: false})

  defp select_emotion_viewer_state(query, user_id) do
    select_merge(query, [info], %{
      viewer_has_reacted: RoaringBitmap.contains(info.user_ids, ^user_id)
    })
  end

  defp maybe_select_collection_stats(query, %{collection?: true}, nil) do
    select_merge(query, [info], %{
      collects_count: info.collects_count,
      latest_collected_users: info.latest_collected_users,
      viewer_has_collected: false
    })
  end

  defp maybe_select_collection_stats(query, %{collection?: true}, user_id) do
    select_merge(query, [info], %{
      collects_count: info.collects_count,
      latest_collected_users: info.latest_collected_users,
      viewer_has_collected: RoaringBitmap.contains(info.collected_user_ids, ^user_id)
    })
  end

  defp maybe_select_collection_stats(query, _info, _user_id), do: query

  defp maybe_put_latest(attrs, nil, _latest_users), do: attrs

  defp maybe_put_latest(attrs, field, latest_users), do: [{field, latest_users} | attrs]

  defp next_latest_users(users, %User{} = user, :add) do
    [snapshot(user) | users]
    |> Enum.uniq_by(&snapshot_user_id/1)
    |> Enum.take(Config.latest_users_limit())
  end

  defp next_latest_users(users, %User{id: user_id}, :remove) do
    Enum.reject(users, &(snapshot_user_id(&1) == user_id))
  end

  defp snapshot(%User{} = user) do
    user
    |> Embeds.User.from_account_user()
    |> Map.from_struct()
  end

  defp snapshot_user_id(%{user_id: user_id}), do: user_id
  defp snapshot_user_id(%{"user_id" => user_id}), do: user_id
  defp snapshot_user_id(_snapshot), do: nil

  defp embedded_replies(%{replies: replies}) when is_list(replies), do: replies
  defp embedded_replies(_comment), do: []
end
