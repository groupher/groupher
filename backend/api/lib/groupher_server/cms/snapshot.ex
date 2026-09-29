defmodule GroupherServer.CMS.Snapshot do
  @moduledoc """
  Stable facade for denormalized display snapshot refresh.

      GraphQL resolver / job / CMS caller
        -> CMS.Snapshot
        -> Snapshot.Projection | Snapshot.Refresh
        -> Snapshot.Reader | Snapshot.Cache

  The facade preserves relation membership and offers stale-first reads by
  default. Internal modules own projection, authority reads, cache policy, and
  refresh orchestration separately.
  """

  alias GroupherServer.CMS

  alias CMS.Snapshot.{Projection, Refresh}

  @type snapshot_kind :: :user | :article | :comment

  @doc "Refreshes a flat list of simple user snapshots."
  @spec users([map()] | nil, keyword()) :: [map()] | nil
  def users(simple_users, opts \\ [])
  def users(nil, _opts), do: nil
  def users([], _opts), do: []

  def users(simple_users, opts) when is_list(simple_users),
    do: Projection.resolve_many(:user, nil, simple_users, opts)

  @doc "Refreshes nested simple user snapshot fields inside a list of items."
  @spec users_in([map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def users_in(items, fields, opts \\ [])
  def users_in(nil, _fields, _opts), do: nil
  def users_in([], _fields, _opts), do: []

  def users_in(items, fields, opts) when is_list(items) and is_list(fields),
    do: Projection.resolve_in(:user, nil, items, fields, opts)

  @doc "Refreshes article display snapshots for one CMS thread."
  @spec articles(atom(), [map()] | nil, keyword()) :: [map()] | nil
  def articles(thread, article_snapshots, opts \\ [])
  def articles(_thread, nil, _opts), do: nil
  def articles(_thread, [], _opts), do: []

  def articles(thread, article_snapshots, opts)
      when is_atom(thread) and is_list(article_snapshots),
      do: Projection.resolve_many(:article, thread, article_snapshots, opts)

  @doc "Refreshes nested article snapshot fields inside a list of items."
  @spec articles_in(atom(), [map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def articles_in(thread, items, fields, opts \\ [])
  def articles_in(_thread, nil, _fields, _opts), do: nil
  def articles_in(_thread, [], _fields, _opts), do: []

  def articles_in(thread, items, fields, opts)
      when is_atom(thread) and is_list(items) and is_list(fields),
      do: Projection.resolve_in(:article, thread, items, fields, opts)

  @doc "Refreshes comment display snapshots for one CMS thread."
  @spec comments(atom(), [map()] | nil, keyword()) :: [map()] | nil
  def comments(thread, comment_snapshots, opts \\ [])
  def comments(_thread, nil, _opts), do: nil
  def comments(_thread, [], _opts), do: []

  def comments(thread, comment_snapshots, opts)
      when is_atom(thread) and is_list(comment_snapshots),
      do: Projection.resolve_many(:comment, thread, comment_snapshots, opts)

  @doc "Refreshes nested comment snapshot fields inside a list of items."
  @spec comments_in(atom(), [map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def comments_in(thread, items, fields, opts \\ [])
  def comments_in(_thread, nil, _fields, _opts), do: nil
  def comments_in(_thread, [], _fields, _opts), do: []

  def comments_in(thread, items, fields, opts)
      when is_atom(thread) and is_list(items) and is_list(fields),
      do: Projection.resolve_in(:comment, thread, items, fields, opts)

  @doc "Enqueues a best-effort batch refresh for later snapshot reads."
  @spec refresh_async(snapshot_kind(), term(), keyword()) :: {:ok, :pass}
  defdelegate refresh_async(kind, refs, opts \\ []), to: Refresh

  @doc "Performs the immediate refresh used by the background snapshot job."
  @spec perform_refresh(snapshot_kind(), term(), keyword()) :: :ok | {:error, term()}
  defdelegate perform_refresh(kind, refs, opts), to: Refresh
end
