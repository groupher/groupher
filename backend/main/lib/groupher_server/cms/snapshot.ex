defmodule GroupherServer.CMS.Snapshot do
  @moduledoc """
  Refreshes denormalized display snapshots without changing source relations.

  The default mode is stale-first: cached summaries patch the given snapshot,
  misses return the original data and enqueue one batch refresh. Use
  `mode: :blocking` when the caller needs fresh display fields in this request.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Snapshot
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Comment, CommentLifecycle}
  alias Helper.Cache

  @pool :snapshot
  @default_opts [mode: :stale_first]
  @default_ttl_seconds 5 * 60

  @type snapshot_kind :: :user | :article | :comment

  @doc """
  Refreshes a list of simple user snapshots.

  Default `:stale_first` mode only patches entries already present in the
  snapshot cache. Cache misses keep the original snapshot and enqueue one batch
  refresh. Use `mode: :blocking` to load fresh summaries from `account.users`
  during the current request.

  ## Examples

      CMS.Snapshot.users([
        %{id: 1, login: "old", nickname: "Old name"}
      ])

      CMS.Snapshot.users([
        %{id: 1, login: "old", nickname: "Old name"}
      ], mode: :blocking)

  """
  @spec users([map()] | nil, keyword()) :: [map()] | nil
  def users(simple_users, opts \\ [])
  def users(nil, _opts), do: nil
  def users([], _opts), do: []

  def users(simple_users, opts) when is_list(simple_users) do
    resolve_many(:user, nil, simple_users, opts)
  end

  @doc """
  Refreshes nested simple user snapshot arrays inside a list of items.

  `fields` accepts atom fields or nested paths. The returned list keeps the
  original item order and only updates the requested list-valued paths. It does
  not add or remove relation members.

  ## Examples

      posts =
        CMS.Snapshot.users_in(posts, [
          [:meta, :latest_upvoted_users],
          [:meta, :latest_collected_users]
        ])

      posts =
        CMS.Snapshot.users_in(posts, [:latest_reacted_users], mode: :blocking)

  """
  @spec users_in([map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def users_in(items, fields, opts \\ [])
  def users_in(nil, _fields, _opts), do: nil
  def users_in([], _fields, _opts), do: []

  def users_in(items, fields, opts) when is_list(items) and is_list(fields) do
    resolve_in(:user, nil, items, fields, opts)
  end

  @doc """
  Refreshes article display snapshots for one CMS thread.

  Default `:stale_first` mode only uses cache hits and leaves stale titles or
  slugs untouched on cache miss. `mode: :blocking` loads fresh public article
  summaries from the thread table and marks missing articles as unavailable.

  ## Examples

      CMS.Snapshot.articles(:post, [
        %{id: 1, title: "Old title", thread: :post}
      ])

      CMS.Snapshot.articles(:doc, doc_snapshots, mode: :blocking)

  """
  @spec articles(atom(), [map()] | nil, keyword()) :: [map()] | nil
  def articles(thread, article_snapshots, opts \\ [])
  def articles(_thread, nil, _opts), do: nil
  def articles(_thread, [], _opts), do: []

  def articles(thread, article_snapshots, opts)
      when is_atom(thread) and is_list(article_snapshots) do
    resolve_many(:article, thread, article_snapshots, opts)
  end

  @doc """
  Refreshes nested article snapshot arrays inside a list of items.

  The thread selects the authority table. Only requested snapshot fields are
  patched, so relation membership, order, and item count stay owned by the
  caller's business query. Paths can point to either one snapshot map or a list
  of snapshot maps.

  ## Examples

      refs = CMS.Snapshot.articles_in(:post, refs, [:article])

      cards =
        CMS.Snapshot.articles_in(:doc, cards, [[:meta, :related_docs]],
          mode: :blocking
        )

  """
  @spec articles_in(atom(), [map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def articles_in(thread, items, fields, opts \\ [])
  def articles_in(_thread, nil, _fields, _opts), do: nil
  def articles_in(_thread, [], _fields, _opts), do: []

  def articles_in(thread, items, fields, opts)
      when is_atom(thread) and is_list(items) and is_list(fields) do
    resolve_in(:article, thread, items, fields, opts)
  end

  @doc """
  Refreshes comment display snapshots for one CMS thread.

  Default mode is stale-first and returns the original snapshot when the cache
  has no summary. Blocking mode loads current comment summaries and uses an
  unavailable placeholder for deleted or missing comments.

  ## Examples

      CMS.Snapshot.comments(:post, [
        %{id: 1, body_digest: "Old digest", thread: :post}
      ])

      CMS.Snapshot.comments(:post, comments, mode: :blocking)

  """
  @spec comments(atom(), [map()] | nil, keyword()) :: [map()] | nil
  def comments(thread, comment_snapshots, opts \\ [])
  def comments(_thread, nil, _opts), do: nil
  def comments(_thread, [], _opts), do: []

  def comments(thread, comment_snapshots, opts)
      when is_atom(thread) and is_list(comment_snapshots) do
    resolve_many(:comment, thread, comment_snapshots, opts)
  end

  @doc """
  Refreshes nested comment snapshot arrays inside a list of items.

  Use this for fields such as reply previews where the enclosing relation has
  already been selected by the caller. Snapshot refresh only patches display
  data at the requested paths. Paths can point to either one snapshot map or a
  list of snapshot maps.

  ## Examples

      comments =
        CMS.Snapshot.comments_in(:post, comments, [[:meta, :replying_to]])

      notifications =
        CMS.Snapshot.comments_in(:post, notifications, [:comment_snapshots],
          mode: :blocking
        )

  """
  @spec comments_in(atom(), [map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def comments_in(thread, items, fields, opts \\ [])
  def comments_in(_thread, nil, _fields, _opts), do: nil
  def comments_in(_thread, [], _fields, _opts), do: []

  def comments_in(thread, items, fields, opts)
      when is_atom(thread) and is_list(items) and is_list(fields) do
    resolve_in(:comment, thread, items, fields, opts)
  end

  @doc """
  Enqueues a batch refresh for snapshot summaries.

  This function is intentionally best-effort. It refreshes cache summaries for
  later requests and never changes the caller's relation set. In test and seed
  environments it returns without enqueueing because background workers are not
  running there.

  ## Examples

      CMS.Snapshot.refresh_async(:user, [1, 2, 3])

      CMS.Snapshot.refresh_async(:article, %{thread: :post, ids: [1, 2]})

      CMS.Snapshot.refresh_async(:comment, %{thread: :post, ids: [10]})

  """
  @spec refresh_async(snapshot_kind(), term(), keyword()) :: {:ok, :pass}
  def refresh_async(kind, refs, opts \\ []) when kind in [:user, :article, :comment] do
    if Application.get_env(:groupher_server, :env) in [:test, :seed_prod] do
      {:ok, :pass}
    else
      enqueue(kind, refs, opts)
    end
  end

  @doc """
  Performs a batch refresh immediately and stores summaries in the snapshot cache.

  This is the job entrypoint executed by background jobs. Normal read paths should use
  `users/2`, `articles/3`, `comments/3`, or their `*_in` variants; event paths
  should use `refresh_async/3`.

  ## Examples

      CMS.Snapshot.perform_refresh(:user, [1, 2, 3], [])

      CMS.Snapshot.perform_refresh(:article, %{thread: :post, ids: [1, 2]}, [])

      CMS.Snapshot.perform_refresh(:comment, %{thread: :post, ids: [10]}, [])

  """
  @spec perform_refresh(snapshot_kind(), term(), keyword()) :: :ok | {:error, term()}
  def perform_refresh(:user, ids, opts) when is_list(ids) do
    :user
    |> load_summaries(nil, ids)
    |> put_summaries(:user, nil, opts)
  end

  def perform_refresh(:article, %{thread: thread, ids: ids}, opts)
      when is_atom(thread) and is_list(ids) do
    :article
    |> load_summaries(thread, ids)
    |> put_summaries(:article, thread, opts)
  end

  def perform_refresh(:comment, %{thread: thread, ids: ids}, opts)
      when is_atom(thread) and is_list(ids) do
    :comment
    |> load_summaries(thread, ids)
    |> put_summaries(:comment, thread, opts)
  end

  def perform_refresh(_kind, _refs, _opts), do: :ok

  defp resolve_many(kind, thread, snapshots, opts) do
    summary_by_id = resolve_summary_by_id(kind, thread, snapshots, opts)

    Enum.map(snapshots, &patch_snapshot(&1, Map.get(summary_by_id, snapshot_id(kind, &1))))
  end

  defp resolve_in(kind, thread, items, fields, opts) do
    paths = Enum.map(fields, &List.wrap/1)
    snapshots = collect_snapshots_from_items(items, paths)
    summary_by_id = resolve_summary_by_id(kind, thread, snapshots, opts)

    patch_items(kind, items, paths, summary_by_id)
  end

  defp resolve_summary_by_id(kind, thread, snapshots, opts) do
    opts = Keyword.merge(@default_opts, opts)
    ids = snapshots |> Enum.map(&snapshot_id(kind, &1)) |> Enum.reject(&is_nil/1) |> Enum.uniq()

    case Keyword.fetch!(opts, :mode) do
      :blocking ->
        kind
        |> load_summaries(thread, ids)
        |> tap(&put_summaries(&1, kind, thread, opts))

      :stale_first ->
        {hits, misses} = cached_summaries(kind, thread, ids)
        enqueue_refresh(kind, thread, misses, opts)
        hits
    end
  end

  defp cached_summaries(kind, thread, ids) do
    Enum.reduce(ids, {%{}, []}, fn id, {hits, misses} ->
      case Cache.get(@pool, cache_key(kind, thread, id)) do
        {:ok, summary} -> {Map.put(hits, id, summary), misses}
        _ -> {hits, [id | misses]}
      end
    end)
  end

  defp enqueue_refresh(_kind, _thread, [], _opts), do: :ok

  defp enqueue_refresh(:user, _thread, ids, opts),
    do: refresh_async(:user, Enum.reverse(ids), opts)

  defp enqueue_refresh(kind, thread, ids, opts) when kind in [:article, :comment] do
    refresh_async(kind, %{thread: thread, ids: Enum.reverse(ids)}, opts)
  end

  defp load_summaries(_kind, _thread, []), do: %{}

  defp load_summaries(:user, _thread, ids) do
    User
    |> where([user], user.id in ^ids)
    |> Repo.all()
    |> Map.new(&{&1.id, user_summary(&1)})
    |> with_unavailable(ids, &unavailable_user/1)
  end

  defp load_summaries(:article, thread, ids) do
    with {:ok, %{model: model}} <- CMS.Artiment.Matcher.match(thread) do
      model
      |> CMS.Gate.scope(nil, :list, %{thread: thread})
      |> where([article], article.id in ^ids)
      |> Repo.all()
      |> Map.new(&{&1.id, article_summary(thread, &1)})
      |> with_unavailable(ids, &unavailable_article(thread, &1))
    else
      _ -> %{}
    end
  end

  defp load_summaries(:comment, thread, ids) do
    Comment
    |> join(:inner, [comment], lifecycle in CommentLifecycle, on: lifecycle.comment_id == comment.id)
    |> where([comment], comment.thread == ^thread and comment.id in ^ids)
    |> select([comment, lifecycle], {comment, lifecycle.state})
    |> Repo.all()
    |> Map.new(fn {comment, state} -> {comment.id, comment_summary(thread, comment, state)} end)
    |> with_unavailable(ids, &unavailable_comment(thread, &1))
  end

  defp put_summaries(summary_by_id, kind, thread, opts) when is_map(summary_by_id) do
    ttl_seconds = Keyword.get(opts, :ttl, @default_ttl_seconds)

    Enum.each(summary_by_id, fn {id, summary} ->
      Cache.put(@pool, cache_key(kind, thread, id), summary, expire_sec: ttl_seconds)
    end)

    :ok
  end

  defp collect_snapshots_from_items(items, paths) do
    Enum.flat_map(items, fn item ->
      Enum.flat_map(paths, fn path ->
        item
        |> get_nested(path)
        |> snapshot_values()
      end)
    end)
  end

  defp patch_items(kind, items, paths, summary_by_id) do
    Enum.map(items, fn item ->
      Enum.reduce(paths, item, fn path, acc ->
        case get_nested(acc, path) do
          value when is_list(value) ->
            put_nested(acc, path, Enum.map(value, &patch_snapshot_by_id(kind, &1, summary_by_id)))

          value when is_map(value) ->
            put_nested(acc, path, patch_snapshot_by_id(kind, value, summary_by_id))

          _ ->
            acc
        end
      end)
    end)
  end

  defp snapshot_values(value) when is_list(value), do: Enum.filter(value, &is_map/1)
  defp snapshot_values(value) when is_map(value), do: [value]
  defp snapshot_values(_value), do: []

  defp patch_snapshot_by_id(kind, snapshot, summary_by_id) do
    patch_snapshot(snapshot, Map.get(summary_by_id, snapshot_id(kind, snapshot)))
  end

  defp patch_snapshot(snapshot, nil), do: snapshot
  defp patch_snapshot(snapshot, summary) when is_map(snapshot), do: Map.merge(snapshot, summary)

  defp snapshot_id(:user, snapshot) when is_map(snapshot) do
    Map.get(snapshot, :id) || Map.get(snapshot, "id") || Map.get(snapshot, :user_id) ||
      Map.get(snapshot, "user_id")
  end

  defp snapshot_id(kind, snapshot) when kind in [:article, :comment] and is_map(snapshot) do
    Map.get(snapshot, :id) || Map.get(snapshot, "id")
  end

  defp snapshot_id(_kind, _snapshot), do: nil

  defp get_nested(data, path) do
    get_in(data, Enum.map(path, &Access.key(&1)))
  end

  defp put_nested(data, path, value) do
    put_in(data, Enum.map(path, &Access.key(&1)), value)
  end

  defp with_unavailable(summary_by_id, ids, fallback_fun) do
    Enum.reduce(ids, summary_by_id, fn id, acc ->
      Map.put_new(acc, id, fallback_fun.(id))
    end)
  end

  defp user_summary(%User{} = user) do
    %{
      id: user.id,
      user_id: user.id,
      login: user.login,
      nickname: user.nickname || user.login,
      avatar: user.avatar,
      bio: user.bio,
      shortbio: user.shortbio,
      updated_at: user.updated_at
    }
  end

  defp article_summary(thread, article) do
    %{
      id: article.id,
      inner_id: article.inner_id,
      title: article.title,
      slug: Map.get(article, :slug),
      thread: thread,
      updated_at: article.updated_at
    }
  end

  defp comment_summary(thread, %Comment{} = comment, :deleted) do
    thread |> unavailable_comment(comment.id) |> Map.put(:body_digest, Comment.delete_hint())
  end

  defp comment_summary(thread, %Comment{} = comment, _state) do
    %{
      id: comment.id,
      body_digest: digest(comment.body),
      article_id: Map.get(comment, :"#{thread}_id"),
      thread: thread,
      updated_at: comment.updated_at
    }
  end

  defp unavailable_user(id) do
    %{
      id: id,
      user_id: id,
      login: "deleted",
      nickname: "Deleted user",
      avatar: nil,
      unavailable: true
    }
  end

  defp unavailable_article(thread, id) do
    %{id: id, title: "Unavailable article", thread: thread, unavailable: true}
  end

  defp unavailable_comment(thread, id) do
    %{id: id, body_digest: "Unavailable comment", thread: thread, unavailable: true}
  end

  defp digest(nil), do: nil

  defp digest(body) do
    if String.length(body) <= 120, do: body, else: String.slice(body, 0, 120)
  end

  defp cache_key(:user, _thread, id), do: "snapshot:user:#{id}"
  defp cache_key(:article, thread, id), do: "snapshot:article:#{thread}:#{id}"
  defp cache_key(:comment, thread, id), do: "snapshot:comment:#{thread}:#{id}"

  defp enqueue(kind, refs, opts) do
    case GroupherServer.Jobs.snapshot_refresh(kind, refs, opts) do
      {:ok, _job} -> {:ok, :pass}
      {:error, _reason} -> {:ok, :pass}
    end
  rescue
    _ -> {:ok, :pass}
  end
end
