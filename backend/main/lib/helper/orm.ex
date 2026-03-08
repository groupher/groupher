defmodule Helper.ORM do
  @moduledoc """
  Unified data-access helpers for common ORM workflows.

  ## Function Groups

  - Query and pagination:
    `paginator/2`, `cursor_paginator/1`, `embeds_paginator/2`,
    `find/2`, `find/3`, `find_by/2`, `find_by/3`, `find_all/2`, `count/1`, `count/2`
  - Create and update:
    `create/2`, `update/2`, `update/3`, `find_update/3`, `update_by/3`,
    `update_embed/3`, `update_embed/4`, `update_dashboard/3`
  - Upsert and idempotent insert:
    `upsert_by/3`, `insert_or_ignore/3`
  - Delete operations:
    `delete/1`, `delete!/1`, `find_delete!/2`, `findby_delete!/2`, `findby_delete/2`,
    `delete_all/2`
  - Counters and meta helpers:
    `inc/2`, `dec/2`, `fill_meta/1`, `update_meta/2`, `mark_read_all/1`
  - Domain shortcuts and row locks:
    `find_user/1`, `find_community/1`, `lock_community/1`, `lock_article/2`
  - Article projection helpers:
    `extract_and_assign_article/1`, `extract_articles/2`
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, done: 3, strip_struct: 1, get_config: 2]
  import ShortMaps

  import Helper.ErrorHandler

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORMAtom, QueryBuilder, T}

  @article_threads get_config(:article, :threads)

  @doc """
  Safely updates JSONB `meta` fields and returns the updated struct.

  ## Examples

      iex> ORM.update_meta(article, %{is_comment_locked: true})
      {:ok, updated_article}

      iex> ORM.update_meta(user, %{follower_user_ids: [1, 2]})
      {:ok, updated_user}
  """
  defdelegate update_meta(queryable, changes), to: ORMAtom

  @doc """
  Increments an integer field by `1` and returns the updated struct.

  ## Examples

      iex> ORM.inc(article, :upvotes_count)
      {:ok, updated_article}
  """
  defdelegate inc(queryable, field), to: ORMAtom

  @doc """
  Decrements an integer field by `1` with floor-at-zero safeguards.

  ## Examples

      iex> ORM.dec(article, :upvotes_count)
      {:ok, updated_article}
  """
  defdelegate dec(queryable, field), to: ORMAtom

  @doc """
  Fills default `meta` payload for structs that do not have it yet.

  ## Examples

      iex> ORM.fill_meta(community)
      {:ok, community_with_default_meta}
  """
  defdelegate fill_meta(queryable), to: ORMAtom

  @doc """
  Returns offset-limit pagination result with `total_count`.

  ## Examples

      iex> ORM.paginator(Post, page: 1, size: 20)
      %{entries: [...], total_count: 120, page_number: 1}

      iex> ORM.paginator(Post, %{page: 2, size: 10})
      %{entries: [...], total_count: 120, page_number: 2}
  """
  def paginator(queryable, page: page, size: size), do: do_pagi(queryable, page, size)
  def paginator(queryable, ~m(page size)a), do: do_pagi(queryable, page, size)

  defp do_pagi(queryable, page, size) do
    result = queryable |> Repo.paginate(page: page, page_size: size)
    total_count = result.total_entries
    result |> Map.put(:total_count, total_count) |> Map.drop([:total_entries])
  end

  @doc """
  Returns cursor-based pagination result.

  ## Examples

      iex> ORM.cursor_paginator(Post)
      {:ok, %{entries: [...], metadata: %{after: _cursor}}}
  """
  def cursor_paginator(queryable) do
    queryable |> Quarto.paginate([limit: 10], Repo)
  end

  # NOTE: should have limit length for list, otherwise it will cause mem issues
  @doc """
  Paginates a normal list (commonly used for embeds).

  ## Examples

      iex> ORM.embeds_paginator([1, 2, 3, 4], %{page: 1, size: 2})
      %{entries: [1, 2], total_count: 4, total_pages: 2}
  """
  def embeds_paginator(list, %{page: page, size: size} = _filter) when is_list(list) do
    chunked_list = Enum.chunk_every(list, size)

    entries = chunked_list |> Enum.at(page - 1)
    total_count = list |> length

    %{
      entries: entries,
      page_number: page,
      page_size: size,
      total_count: total_count,
      total_pages: chunked_list |> length
    }
  end

  @doc """
  Finds a record by id with preload and normalized result format.

  ## Examples

      iex> ORM.find(Post, 1, preload: :author)
      {:ok, %Post{}}

      iex> ORM.find(Post, -1, preload: :author)
      {:error, {:not_exist, _}}
  """
  def find(queryable, id, preload: preload) do
    queryable
    |> preload(^preload)
    |> Repo.get(id)
    |> done(queryable, id)
  end

  @doc """
  Finds a record by id and returns `{:ok, struct}` or `{:error, reason}`.

  ## Examples

      iex> ORM.find(Post, 1)
      {:ok, %Post{}}

      iex> ORM.find(Post, -1)
      {:error, {:not_exist, _}}
  """
  @spec find(Ecto.Queryable.t(), T.id()) :: {:ok, any()} | {:error, T.error()}
  def find(queryable, id) do
    queryable
    |> Repo.get(id)
    |> done(queryable, id)
  end

  @doc """
  Finds one record by clauses and returns normalized result.

  ## Examples

      iex> ORM.find_by(User, login: "alice")
      {:ok, %User{}}

      iex> ORM.find_by(User, login: "missing")
      {:error, {:not_exist, _}}
  """
  def find_by(queryable, clauses) do
    queryable
    |> Repo.get_by(clauses)
    |> case do
      nil ->
        {:error, {:not_exist, not_found_formatter(queryable, clauses)}}

      result ->
        {:ok, result}
    end
  end

  @doc """
  Finds one record by clauses with preload.

  ## Examples

      iex> ORM.find_by(Post, [id: 1], preload: :author)
      {:ok, %Post{author: %Author{}}}
  """
  def find_by(queryable, clauses, preload: preload) do
    queryable
    |> preload(^preload)
    |> Repo.get_by(clauses)
    |> case do
      nil ->
        {:error, {:not_exist, not_found_formatter(queryable, clauses)}}

      result ->
        {:ok, result}
    end
  end

  @doc """
  Finds records by filter; paginated when `page` and `size` are provided.

  ## Examples

      iex> ORM.find_all(Post, %{page: 1, size: 20, community: "elixir"})
      {:ok, %{entries: [...], total_count: 42}}

      iex> ORM.find_all(Post, %{community: "elixir"})
      {:ok, [%Post{}, ...]}
  """
  # TODO: find article not mark_delete by default
  def find_all(queryable, %{page: page, size: size} = filter) do
    queryable
    |> QueryBuilder.filter_pack(filter)
    |> paginator(page: page, size: size)
    |> done()
  end

  def find_all(queryable, filter) do
    queryable |> QueryBuilder.filter_pack(filter) |> Repo.all() |> done()
  end

  @doc """
  Marks all matched rows as read.

  ## Examples

      iex> ORM.mark_read_all(Notification)
      {:ok, {count, _}}
  """
  def mark_read_all(queryable) do
    queryable
    |> Repo.update_all(set: [read: true])
    |> done
  end

  @doc """
  Deletes one struct directly.

  Use with authorization checks in upper layers.

  ## Examples

      iex> ORM.delete(comment)
      {:ok, %Comment{}}
  """
  def delete(content), do: Repo.delete(content)

  @doc """
  Deletes one struct and raises on failure.

  ## Examples

      iex> ORM.delete!(comment)
      %Comment{}
  """
  def delete!(content), do: Repo.delete!(content)

  @doc """
  Finds a record by id and deletes it.

  ## Examples

      iex> ORM.find_delete!(Post, 1)
      {:ok, %Post{}}
  """
  def find_delete!(queryable, id) do
    with {:ok, content} <- find(queryable, id) do
      delete(content)
    end
  end

  @doc """
  Finds a record by clauses and deletes it.

  ## Examples

      iex> ORM.findby_delete!(Post, %{id: 1})
      {:ok, %Post{}}
  """
  def findby_delete!(queryable, clauses) do
    with {:ok, content} <- find_by(queryable, clauses) do
      delete(content)
    end
  end

  @doc """
  Finds a record by clauses and deletes it if present.

  Returns `{:ok, :pass}` when no record is found.

  ## Examples

      iex> ORM.findby_delete(Post, %{id: 1})
      {:ok, %Post{}}

      iex> ORM.findby_delete(Post, %{id: -1})
      {:ok, :pass}
  """
  def findby_delete(queryable, clauses) do
    case find_by(queryable, clauses) do
      {:ok, content} -> delete(content)
      _ -> {:ok, :pass}
    end
  end

  @doc """
  Deletes all rows if any matched rows exist.

  ## Examples

      iex> ORM.delete_all(from(p in Post, where: p.mark_delete == true), :if_exist)
      {:ok, {count, _}}
  """
  def delete_all(queryable, :if_exist) do
    case Repo.exists?(queryable) do
      true -> {:ok, Repo.delete_all(queryable)}
      false -> {:ok, :pass}
    end
  end

  @doc """
  Updates one struct with strict `update_changeset/2`.

  ## Examples

      iex> ORM.update(post, %{title: "new"})
      {:ok, %Post{title: "new"}}
  """
  def update(content, attrs) do
    content |> content.__struct__.update_changeset(attrs) |> Repo.update()
  end

  @doc """
  Updates one struct with non-strict changeset.

  This is mainly used for tests or simple patch updates.

  ## Examples

      iex> ORM.update(post, %{title: "new"}, strict: false)
      {:ok, %Post{title: "new"}}
  """
  def update(content, attrs, strict: false) do
    content |> Ecto.Changeset.change(attrs) |> Repo.update()
  end

  @doc """
  Finds a record by id then updates it with `changeset/2`.

  ## Examples

      iex> ORM.find_update(Post, 1, %{title: "new"})
      {:ok, %Post{title: "new"}}
  """
  def find_update(queryable, id, attrs), do: do_find_update(queryable, id, attrs)
  def find_update(queryable, %{id: id} = attrs), do: do_find_update(queryable, id, attrs)

  defp do_find_update(queryable, id, attrs) do
    with {:ok, content} <- find(queryable, id) do
      content
      |> content.__struct__.changeset(attrs)
      |> Repo.update()
    end
  end

  @doc """
  Finds a record by clauses then updates it with `Ecto.Changeset.change/2`.

  ## Examples

      iex> ORM.update_by(User, %{login: "alice"}, %{nickname: "Alice"})
      {:ok, %User{nickname: "Alice"}}
  """
  def update_by(source, clauses, attrs) do
    with {:ok, content} <- find_by(source, clauses) do
      content
      |> Ecto.Changeset.change(attrs)
      |> Repo.update()
    end
  end

  @doc """
  Upserts one row by conflict target inferred from `clauses` keys.

  `clauses` accepts keyword list or map.

  ## Examples

      iex> ORM.upsert_by(Customization, [user_id: user.id], %{user_id: user.id, theme: "light"})
      {:ok, %Customization{}}

      iex> ORM.upsert_by(Customization, %{user_id: user.id}, %{user_id: user.id, theme: "dark"})
      {:ok, %Customization{}}
  """
  def upsert_by(queryable, clauses, attrs) do
    conflict_target = clause_keys(clauses)
    attrs = attrs |> normalize_attrs()

    changeset =
      queryable
      |> struct
      |> queryable.changeset(attrs)

    set_fields =
      changeset.changes
      |> Map.drop(conflict_target)
      |> Enum.to_list()

    changeset
    |> Repo.insert(
      on_conflict: upsert_set_clause(set_fields),
      conflict_target: conflict_target
    )
  end

  @doc """
  Inserts one row and ignores conflicts.

  ## Examples

      iex> ORM.insert_or_ignore(Customization, %{user_id: user.id}, conflict_target: [:user_id])
      {:ok, %Customization{}}
  """
  def insert_or_ignore(queryable, attrs, conflict_target: conflict_target) do
    attrs = attrs |> normalize_attrs()

    queryable
    |> struct
    |> queryable.changeset(attrs)
    |> Repo.insert(on_conflict: :nothing, conflict_target: conflict_target)
  end

  @doc """
  Creates one row using schema `changeset/2`.

  ## Examples

      iex> ORM.create(User, %{login: "alice", nickname: "Alice", avatar: "x"})
      {:ok, %User{}}
  """
  def create(model, attrs) do
    model
    |> struct
    |> model.changeset(attrs)
    |> Repo.insert()
  end

  defp upsert_set_clause([]), do: :nothing
  defp upsert_set_clause(set_fields), do: [set: set_fields]

  defp clause_keys(clauses) when is_list(clauses), do: Keyword.keys(clauses)
  defp clause_keys(clauses) when is_map(clauses), do: Map.keys(clauses)

  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)

  @doc """
  Counts rows for a queryable with optional DB prefix.

  ## Examples

      iex> ORM.count(Post)
      {:ok, 10}

      iex> ORM.count(Post, prefix: "cms")
      {:ok, 10}
  """
  def count(queryable, prefix: prefix) do
    queryable |> Repo.aggregate(:count, prefix: prefix) |> done
  end

  def count(queryable) do
    queryable |> Repo.aggregate(:count) |> done
  end

  @doc """
  Updates a dashboard embed key.

  For list-like embed keys (`:header_links`, `:footer_links`, etc), values are replaced.
  For map-like keys, existing and incoming fields are merged.

  ## Examples

      iex> ORM.update_dashboard(dashboard, :header_links, [%{title: "Docs"}])
      {:ok, %CommunityDashboard{}}

      iex> ORM.update_dashboard(dashboard, :seo, %{title: "Elixir"})
      {:ok, %CommunityDashboard{}}
  """
  def update_dashboard(%CommunityDashboard{} = community_dashboard, field, args)
      when field in [
             # those fields are array maps
             :header_links,
             :footer_links,
             :name_alias,
             :social_links,
             :media_reports,
             :faqs
           ] do
    community_dashboard
    |> Ecto.Changeset.change(%{})
    |> Ecto.Changeset.put_embed(field, args)
    |> Repo.update()
  end

  def update_dashboard(%CommunityDashboard{} = community_dashboard, key, args) do
    merged_args =
      community_dashboard[key] |> ensure_dashboard_key_exist |> Map.merge(args) |> strip_struct

    community_dashboard
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_embed(key, merged_args)
    |> Repo.update()
  end

  # the key in dashboard table are all jsonb format
  defp ensure_dashboard_key_exist(nil), do: %{}
  defp ensure_dashboard_key_exist(settings), do: settings

  @doc """
  Updates embed fields and additional scalar changes in one call.

  ## Examples

      iex> ORM.update_embed(comment, :replies, replies, %{replies_count: 2})
      {:ok, %Comment{}}
  """
  def update_embed(queryable, key, value, changes) do
    queryable
    |> Ecto.Changeset.change(changes)
    |> Ecto.Changeset.put_embed(key, value)
    |> Repo.update()
  end

  @doc """
  Updates one embed field.

  ## Examples

      iex> ORM.update_embed(comment, :replies, replies)
      {:ok, %Comment{}}
  """
  def update_embed(queryable, key, value) do
    queryable
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_embed(key, value)
    |> Repo.update()
  end

  @doc """
  Extracts common article info from reaction rows and assigns it to `:article`.

  ## Examples

      iex> ORM.extract_and_assign_article(%{entries: reaction_entries})
      %{entries: [%{article: %{id: 1, title: "..."}}]}
  """
  def extract_and_assign_article(%{entries: entries} = paged_articles) do
    entries =
      Enum.map(entries, fn item ->
        thread = Enum.find(@article_threads, &(not is_nil(Map.get(item, :"#{&1}_id"))))
        Map.merge(item, %{article: export_article_info(thread, Map.get(item, thread))})
      end)

    paged_articles |> Map.put(:entries, entries)
  end

  @doc """
  Extracts normalized article info for paged entries.

  ## Examples

      iex> ORM.extract_articles(%{entries: entries})
      %{entries: [%{id: 1, title: "...", thread: :post}]}
  """
  @spec extract_articles(T.paged_data(), [atom()]) :: T.paged_article_common()
  def extract_articles(%{entries: entries} = paged_articles, threads \\ @article_threads) do
    paged_articles
    |> Map.put(:entries, Enum.map(entries, &extract_article_info(&1, threads)))
  end

  @doc """
  Finds a user by login.

  ## Examples

      iex> ORM.find_user("alice")
      {:ok, %User{}}
  """
  def find_user(login) when is_binary(login) do
    User |> find_by(%{login: login})
  end

  @doc """
  Finds one community by slug or aka with dashboard and moderators preloaded.

  ## Examples

      iex> ORM.find_community("elixir")
      {:ok, %Community{}}
  """
  def find_community(slug) do
    Community
    # |> where([c], c.pending == ^@community_normal)
    |> where([c], c.slug == ^slug or c.aka == ^slug)
    |> preload(:dashboard)
    |> preload(moderators: :user)
    |> Repo.one()
    |> done
  end

  @doc """
  Locks one community row with `FOR UPDATE` and returns it.

  ## Examples

      iex> ORM.lock_community(%Community{id: 1})
      {:ok, %Community{}}
  """
  def lock_community(%Community{id: id}) do
    Community
    |> where(id: ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> done
  end

  @doc """
  Locks one article row with `FOR UPDATE` and optional preloads.

  ## Examples

      iex> ORM.lock_article(post, [:author])
      {:ok, %Post{}}
  """
  def lock_article(article, preload \\ []) do
    article.__struct__
    |> where(id: ^article.id)
    |> preload(^preload)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> done
  end

  defp extract_article_info(reaction, threads) do
    thread = Enum.find(threads, &(not is_nil(Map.get(reaction, &1))))
    article = Map.get(reaction, thread)

    export_article_info(thread, article)
  end

  defp export_article_info(thread, article) do
    author = article.author.user

    %{
      thread: thread,
      id: article.id,
      title: article.title,
      upvotes_count: Map.get(article, :upvotes_count),
      author: author
    }
  end
end
