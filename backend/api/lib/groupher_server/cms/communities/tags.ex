defmodule GroupherServer.CMS.Communities.Tags do
  alias GroupherServer.CMS.QueryBuilder
  @moduledoc """
  Owns community-tag creation, update, grouping, and article assignment workflows.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Tags
        -> Repo / Oban
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  import GroupherServer.CMS.Articles.Writer,
    only: [ensure_author_exists: 1]

  alias GroupherServer.{CMS, Repo}

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.ErrorCat
  alias GroupherServer.CMS.Communities.TagStats
  alias GroupherServer.CMS.FrontDesk
  alias GroupherServer.CMS.Model.{Community, CommunityTag, CommunityTagGroup}
  alias Helper.{Datetime, Multi, ORM, T}

  @doc """
  create a community tag
  """
  @spec create(Community.t(), atom(), map(), User.t()) ::
          {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def create(%Community{} = community, thread, attrs, %User{
        id: user_id
      }) do
    with {:ok, author} <- ensure_author_exists(%User{id: user_id}),
         {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <-
           find_group_in_thread(
             community,
             thread,
             Map.get(attrs, :group_id),
             Map.get(attrs, :group)
           ) do
      Multi.new()
      |> Multi.run(:create_tag, fn _, _ ->
        attrs =
          Map.merge(attrs, %{
            author_id: author.id,
            community_id: community.id,
            group_id: group.id,
            thread: thread
          })
          |> Map.drop([:group])

        ORM.create(CommunityTag, attrs)
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CMS.Communities.update_count_field(
          community,
          :community_tags_count
        )
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  update a community tag
  """
  @spec update(T.id(), map()) :: {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def update(id, attrs) do
    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, attrs} <- normalize_update_attrs(tag, attrs) do
      tag
      |> ORM.update(attrs)
      |> preload_tag_group()
    end
  end

  @doc """
  create a community tag group
  """
  @spec create_group(Community.t(), atom(), map()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def create_group(%Community{} = community, thread, attrs) do
    with {:ok, community} <- ORM.find_by(Community, slug: community.slug) do
      attrs =
        attrs
        |> Map.merge(%{
          community_id: community.id,
          thread: thread,
          index: next_group_index(community, thread)
        })

      CommunityTagGroup
      |> ORM.create(attrs)
      |> preload_group_tags()
    end
  end

  @doc """
  update a community tag group
  """
  @spec update_group(Community.t(), atom(), T.id(), map()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def update_group(%Community{} = community, thread, id, attrs) do
    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      group |> ORM.update(attrs) |> preload_group_tags()
    end
  end

  def update_group(id, attrs) do
    CommunityTagGroup
    |> ORM.find(id)
    |> case do
      {:ok, group} -> group |> ORM.update(attrs) |> preload_group_tags()
      error -> error
    end
  end

  @doc """
  delete a community tag group
  """
  @spec delete_group(Community.t(), atom(), T.id()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def delete_group(%Community{} = community, thread, id) do
    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      Repo.transaction(fn ->
        delete_group_and_update_count(community, group)
      end)
    end
  end

  defp delete_group_and_update_count(community, group) do
    case ORM.delete(group) do
      {:ok, deleted_group} ->
        case CMS.Communities.update_count_field(community, :community_tags_count) do
          {:ok, _} -> deleted_group
          {:error, reason} -> Repo.rollback(reason)
        end

      {:error, reason} ->
        Repo.rollback(reason)
    end
  end

  @doc """
  delete a community tag
  """
  @spec delete(T.id()) :: {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def delete(id) do
    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, community} <- ORM.find(Community, tag.community_id) do
      Multi.new()
      |> Multi.run(:delete_tag, fn _, _ ->
        ORM.delete(tag)
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CMS.Communities.update_count_field(
          community,
          :community_tags_count
        )
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp do_update_tags_assoc(article, tags, opt) when is_list(tags) do
    article = Repo.preload(article, :community_tags)
    old_tags = article.community_tags

    removing_ids = MapSet.new(tags, & &1.id)

    community_tags =
      case opt do
        :add -> Enum.uniq_by(old_tags ++ tags, & &1.id)
        :remove -> Enum.reject(old_tags, &MapSet.member?(removing_ids, &1.id))
        :overwrite -> tags
      end

    if same_tag_ids?(old_tags, community_tags) do
      {:ok, article}
    else
      Repo.transaction(fn ->
        with {:ok, updated_article} <-
               article
               |> Ecto.Changeset.change()
               |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
               |> Repo.update(),
             {:ok, :pass} <- sync_tag_stats(updated_article, article, old_tags) do
          updated_article
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp same_tag_ids?(left, right) do
    MapSet.new(Enum.map(left, & &1.id)) == MapSet.new(Enum.map(right, & &1.id))
  end

  defp find_related_tags([], _filter), do: {:ok, []}

  defp find_related_tags(tag_ids, %{community_id: community_id, thread: thread}) do
    casted_tag_ids = tag_ids |> Enum.map(&cast_id!/1) |> Enum.uniq()
    positions = casted_tag_ids |> Enum.with_index() |> Map.new()

    tags =
      CommunityTag
      |> where([t], t.community_id == ^community_id)
      |> where([t], t.thread == ^thread)
      |> where([t], t.id in ^casted_tag_ids)
      |> Repo.all()
      |> Enum.sort_by(&Map.fetch!(positions, &1.id))

    if length(tags) == length(casted_tag_ids) do
      {:ok, tags}
    else
      invalid_domain_tag("tag not in same community & thread")
    end
  end

  @doc """
  set tags by list of tag_ids (overwrite)
  """
  @spec overwrite(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          {:ok, Ecto.Schema.t()} | {:error, any()}
  def overwrite(%Community{id: cid}, thread, article, %{
        community_tags: tag_ids
      }) do
    check_filter = %{community_id: cid, thread: thread}

    with {:ok, related_tags} <- find_related_tags(tag_ids, check_filter) do
      do_update_tags_assoc(article, related_tags, :overwrite)
    end
  end

  def set(_, _, article, %{community_tags: []}), do: {:ok, article}

  def set(%Community{id: cid}, thread, article, %{
        community_tags: tag_ids
      }) do
    check_filter = %{community_id: cid, thread: thread}

    with {:ok, related_tags} <- find_related_tags(tag_ids, check_filter) do
      do_update_tags_assoc(article, related_tags, :add)
    end
  end

  def set(_community, _thread, article, _), do: {:ok, article}

  @doc """
  add a tag to article
  """
  @spec add(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def add(article, tag_id) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, [tag], :add)
    end
  end

  @doc """
  remove a tag from article
  """
  @spec remove(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def remove(article, tag_id) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, [tag], :remove)
    end
  end

  defp sync_tag_stats(updated_article, article, old_tags) do
    new_tags = Map.get(updated_article, :community_tags, [])

    old_ids = MapSet.new(Enum.map(old_tags, & &1.id))
    new_ids = MapSet.new(Enum.map(new_tags, & &1.id))

    added_tags = Enum.reject(new_tags, &MapSet.member?(old_ids, &1.id))
    removed_tags = Enum.reject(old_tags, &MapSet.member?(new_ids, &1.id))

    deltas = Enum.map(added_tags, &{&1, 1}) ++ Enum.map(removed_tags, &{&1, -1})
    TagStats.update_many(article, deltas)
  end

  @doc """
  list tag groups with tags
  """
  @spec groups(map()) :: {:ok, list(CommunityTagGroup.t())} | {:error, any()}
  def groups(filter) do
    filter = replace_community_ifneed(filter)

    CommunityTagGroup
    |> QueryBuilder.filter_pack(filter)
    |> order_by([g], asc: g.index, asc: g.id)
    |> preload([g],
      tags:
        ^from(t in CommunityTag,
          order_by: [asc: t.index, asc: t.id],
          preload: [:community, :tag_group]
        )
    )
    |> Repo.all()
    |> done()
  end

  @doc """
  reindex tags in spec group
  """
  @spec reindex_in_group(Community.t(), atom(), T.id(), list()) :: {:ok, atom()} | {:error, any()}
  def reindex_in_group(%Community{} = community, thread, group_id, indexed_tags) do
    with {:ok, group_tags} <- find_group_tags(community, thread, group_id),
         {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, false),
         :ok <- validate_complete_reindex(group_tags, indexed_tags) do
      run_batch_reindex(fn ->
        batch_reindex_tags(community, thread, indexed_tags, false)
      end)
    end
  end

  def reindex_in_group(community, thread, group_id, indexed_tags) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex_in_group(community, thread, group_id, indexed_tags)
    end
  end

  @doc """
  reindex tags across groups
  """
  @spec reindex(Community.t(), atom(), list()) :: {:ok, atom()} | {:error, any()}
  def reindex(%Community{} = community, thread, indexed_tags) do
    with {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, true),
         :ok <- validate_indexed_tags(community, thread, indexed_tags),
         :ok <- validate_indexed_tags_groups(community, thread, indexed_tags) do
      run_batch_reindex(fn ->
        batch_reindex_tags(community, thread, indexed_tags, true)
      end)
    end
  end

  def reindex(community, thread, indexed_tags) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex(community, thread, indexed_tags)
    end
  end

  @doc """
  reindex tag groups
  """
  @spec reindex_groups(Community.t() | String.t(), atom(), list()) ::
          {:ok, atom()} | {:error, any()}
  def reindex_groups(%Community{} = community, thread, indexed_groups) do
    with {:ok, indexed_groups} <- normalize_indexed_tags(indexed_groups, false),
         :ok <- validate_indexed_groups(community, thread, indexed_groups) do
      run_batch_reindex(fn -> batch_reindex_groups(community, thread, indexed_groups) end)
    end
  end

  def reindex_groups(community, thread, indexed_groups) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex_groups(community, thread, indexed_groups)
    end
  end

  defp find_group_in_thread(%Community{} = community, thread, group_id, _group_title)
       when not is_nil(group_id) do
    find_group_in_thread(community, thread, group_id)
  end

  defp find_group_in_thread(%Community{} = community, thread, _group_id, group_title)
       when is_binary(group_title) do
    title = String.trim(group_title)

    if title === "" do
      invalid_domain_tag("tag group required")
    else
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.title == ^title)
      |> Repo.one()
      |> case do
        %CommunityTagGroup{} = group ->
          {:ok, group}

        _ ->
          create_group(community, thread, %{title: title})
      end
    end
  end

  defp find_group_in_thread(_, _, _, _),
    do: invalid_domain_tag("tag group required")

  defp find_group_in_thread(%Community{} = community, thread, group_id)
       when not is_nil(group_id) do
    group_id = cast_id!(group_id)

    CommunityTagGroup
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.thread == ^thread)
    |> where([g], g.id == ^group_id)
    |> Repo.one()
    |> case do
      %CommunityTagGroup{} = group -> {:ok, group}
      _ -> invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp normalize_update_attrs(%CommunityTag{} = tag, attrs) do
    attrs = Map.drop(attrs, [:group])

    case Map.get(attrs, :group_id) do
      nil ->
        {:ok, attrs}

      group_id ->
        with {:ok, _group} <-
               find_group_in_thread(%Community{id: tag.community_id}, tag.thread, group_id) do
          {:ok, attrs}
        end
    end
  end

  defp normalize_indexed_tags(indexed_tags, include_group?) do
    normalized =
      Enum.map(indexed_tags, fn item ->
        item
        |> Map.put(:id, cast_id!(item.id))
        |> Map.put(:index, cast_index!(item.index))
        |> then(fn item ->
          if include_group?, do: Map.put(item, :group_id, cast_id!(item.group_id)), else: item
        end)
      end)

    ids = Enum.map(normalized, & &1.id)

    if length(ids) == MapSet.size(MapSet.new(ids)) do
      {:ok, normalized}
    else
      invalid_domain_tag("duplicate ids in reindex payload")
    end
  end

  defp validate_complete_reindex(group_tags, indexed_tags) do
    group_ids = MapSet.new(group_tags, & &1.id)
    indexed_ids = MapSet.new(indexed_tags, & &1.id)

    if group_ids == indexed_ids do
      :ok
    else
      invalid_domain_tag("reindex payload must contain exactly the tags in the group")
    end
  end

  defp validate_indexed_tags(%Community{} = community, thread, indexed_tags) do
    ids = Enum.map(indexed_tags, & &1.id)

    valid_ids =
      CommunityTag
      |> where([t], t.community_id == ^community.id)
      |> where([t], t.thread == ^thread)
      |> where([t], t.id in ^ids)
      |> select([t], t.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(ids) == valid_ids do
      :ok
    else
      invalid_domain_tag("tag not in same community & thread")
    end
  end

  defp validate_indexed_tags_groups(%Community{} = community, thread, indexed_tags) do
    group_ids = indexed_tags |> Enum.map(& &1.group_id) |> Enum.uniq()

    valid_group_ids =
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^group_ids)
      |> select([g], g.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(group_ids) == valid_group_ids do
      :ok
    else
      invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp validate_indexed_groups(%Community{} = community, thread, indexed_groups) do
    ids = Enum.map(indexed_groups, & &1.id)

    valid_ids =
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^ids)
      |> select([g], g.id)
      |> Repo.all()
      |> MapSet.new()

    if MapSet.new(ids) == valid_ids do
      :ok
    else
      invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp run_batch_reindex(update_fun) do
    Repo.transaction(fn ->
      case update_fun.() do
        {:ok, :pass} -> :pass
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> result()
  end

  defp batch_reindex_tags(_community, _thread, [], _include_group?), do: {:ok, :pass}

  defp batch_reindex_tags(%Community{} = community, thread, indexed_tags, include_group?) do
    ids = Enum.map(indexed_tags, & &1.id)
    indexes = Enum.map(indexed_tags, & &1.index)
    now = Datetime.now(:second)

    {query, params} =
      if include_group? do
        query = """
        UPDATE cms.community_tags AS tag
        SET group_id = updates.group_id,
            "index" = updates.new_index,
            updated_at = $6
        FROM UNNEST($1::bigint[], $2::bigint[], $3::integer[])
          AS updates(id, group_id, new_index)
        WHERE tag.id = updates.id
          AND tag.community_id = $4
          AND tag.thread = $5
        """

        {query,
         [
           ids,
           Enum.map(indexed_tags, & &1.group_id),
           indexes,
           community.id,
           Atom.to_string(thread),
           now
         ]}
      else
        query = """
        UPDATE cms.community_tags AS tag
        SET "index" = updates.new_index,
            updated_at = $5
        FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
        WHERE tag.id = updates.id
          AND tag.community_id = $3
          AND tag.thread = $4
        """

        {query, [ids, indexes, community.id, Atom.to_string(thread), now]}
      end

    query
    |> Repo.query(params)
    |> expect_updated_rows(length(ids))
  end

  defp batch_reindex_groups(_community, _thread, []), do: {:ok, :pass}

  defp batch_reindex_groups(%Community{} = community, thread, indexed_groups) do
    ids = Enum.map(indexed_groups, & &1.id)
    indexes = Enum.map(indexed_groups, & &1.index)

    query = """
    UPDATE cms.community_tag_groups AS tag_group
    SET "index" = updates.new_index,
        updated_at = $5
    FROM UNNEST($1::bigint[], $2::integer[]) AS updates(id, new_index)
    WHERE tag_group.id = updates.id
      AND tag_group.community_id = $3
      AND tag_group.thread = $4
    """

    query
    |> Repo.query([ids, indexes, community.id, Atom.to_string(thread), Datetime.now(:second)])
    |> expect_updated_rows(length(ids))
  end

  defp expect_updated_rows({:ok, %{num_rows: expected}}, expected), do: {:ok, :pass}

  defp expect_updated_rows({:ok, _result}, _expected),
    do: invalid_domain_tag("reindex target changed")

  defp expect_updated_rows({:error, reason}, _expected), do: {:error, reason}

  defp cast_id!(id) do
    case Ecto.Type.cast(:id, id) do
      {:ok, casted_id} -> casted_id
      :error -> invalid_domain_tag("invalid tag group id")
    end
  end

  defp cast_index!(index) do
    case Ecto.Type.cast(:integer, index) do
      {:ok, casted_index} -> casted_index
      :error -> raise ArgumentError, "invalid tag index"
    end
  end

  defp next_group_index(%Community{} = community, thread) do
    CommunityTagGroup
    |> where([g], g.community_id == ^community.id)
    |> where([g], g.thread == ^thread)
    |> select([g], max(g.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end

  defp find_group_tags(%Community{} = community, thread, group_id) do
    group_id = cast_id!(group_id)

    CommunityTag
    |> where([t], t.community_id == ^community.id)
    |> where([t], t.thread == ^thread)
    |> where([t], t.group_id == ^group_id)
    |> Repo.all()
    |> done
  end

  defp preload_group_tags({:ok, %CommunityTagGroup{} = group}) do
    {:ok, Repo.preload(group, tags: [:community, :tag_group])}
  end

  defp preload_group_tags(result), do: result

  defp preload_tag_group({:ok, %CommunityTag{} = tag}) do
    {:ok, Repo.preload(tag, [:community, :tag_group])}
  end

  defp preload_tag_group(result), do: result

  defp replace_community_ifneed(filter) when is_map(filter) do
    filter
    |> Enum.map(fn {k, v} ->
      new_key =
        case k do
          :community -> :community_slug
          _ -> k
        end

      {new_key, v}
    end)
    |> Map.new()
  end

  defp result({:ok, %{create_tag: result}}), do: {:ok, result}
  defp result({:ok, %{delete_tag: result}}), do: {:ok, result}
  defp result({:ok, result}), do: {:ok, result}
  defp result({:error, _, result, _steps}), do: {:error, result}
  defp result({:error, result}), do: {:error, result}

  defp invalid_domain_tag(details), do: {:error, ErrorCat.invalid_domain_tag(details)}
end
