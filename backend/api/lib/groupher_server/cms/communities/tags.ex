defmodule GroupherServer.CMS.Communities.Tags do
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

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User

  alias CMS.{
    Communities.ErrorCat,
    Communities.TagPersist,
    Communities.TagStats,
    FrontDesk,
    QueryBuilder
  }

  alias CMS.Articles.Bindings.Tags, as: BindingTags
  alias CMS.Model.{Article, ArticleBinding, Community, CommunityTag, CommunityTagGroup}
  alias Helper.{ORM, T}

  @doc "Returns tag-group titles keyed by id in one query."
  @spec group_titles([T.id()]) :: map()
  def group_titles(ids) when is_list(ids) do
    CommunityTagGroup
    |> where([group], group.id in ^Enum.uniq(ids))
    |> select([group], {group.id, group.title})
    |> Repo.all()
    |> Map.new()
  end

  @doc """
  create a community tag
  """
  @spec create(Community.t(), atom(), map(), User.t()) ::
          {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def create(community, thread, attrs, user), do: create(community, thread, attrs, user, [])

  @spec create(Community.t(), atom(), map(), User.t(), keyword()) ::
          {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def create(%Community{} = community, thread, attrs, %User{id: user_id}, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, author} <- ensure_author_exists(%User{id: user_id}),
         {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <-
           find_group_in_thread(
             community,
             thread,
             Map.get(attrs, :group_id),
             Map.get(attrs, :group),
             opts
           ) do
      transact(fn ->
        attrs =
          Map.merge(attrs, %{
            author_id: author.id,
            community_id: community.id,
            group_id: group.id,
            thread: thread
          })
          |> Map.drop([:group])

        with {:ok, tag} <-
               TagPersist.create_tag(
                 community,
                 thread,
                 Map.drop(attrs, [:author_id, :community_id, :group_id, :thread]),
                 author.id,
                 group.id
               ),
             {:ok, _} <- CMS.Communities.update_count_field(community, :community_tags_count),
             {:ok, _} <- invalidate_taxonomy(community, thread, "tag:create:#{tag.id}", opts) do
          tag
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  update a community tag
  """
  @spec update(T.id(), map()) :: {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def update(id, attrs), do: update_with_identity(id, attrs, [])

  def update(id, attrs, opts), do: update_with_identity(id, attrs, opts)

  defp update_with_identity(id, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, attrs} <- normalize_update_attrs(tag, attrs) do
      transact(fn ->
        with {:ok, updated} <- TagPersist.update_tag(tag, attrs),
             {:ok, _} <-
               invalidate_taxonomy_by_tag(
                 updated,
                 "tag:update:#{updated.id}:#{updated.updated_at}",
                 opts
               ) do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  create a community tag group
  """
  @spec create_group(Community.t(), atom(), map()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def create_group(community, thread, attrs), do: create_group(community, thread, attrs, [])

  def create_group(%Community{} = community, thread, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, community} <- ORM.find_by(Community, slug: community.slug) do
      transact(fn ->
        with {:ok, group} <-
               TagPersist.create_group(
                 community,
                 thread,
                 attrs,
                 next_group_index(community, thread)
               ),
             {:ok, _} <-
               invalidate_taxonomy(community, thread, "tag-group:create:#{group.id}", opts),
             {:ok, group} <- preload_group_tags({:ok, group}) do
          group
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  @doc """
  update a community tag group
  """
  @spec update_group(Community.t(), atom(), T.id(), map()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def update_group(community, thread, id, attrs),
    do: update_group(community, thread, id, attrs, [])

  def update_group(%Community{} = community, thread, id, attrs, opts) do
    {attrs, opts} = split_identity(attrs, opts)

    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      transact(fn ->
        with {:ok, updated} <- TagPersist.update_group(group, attrs),
             {:ok, _} <-
               invalidate_taxonomy(
                 community,
                 thread,
                 "tag-group:update:#{updated.id}:#{updated.updated_at}",
                 opts
               ),
             {:ok, updated} <- {:ok, updated} do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def update_group(id, attrs) do
    CommunityTagGroup
    |> ORM.find(id)
    |> case do
      {:ok, group} -> TagPersist.update_group(group, attrs)
      error -> error
    end
  end

  @doc """
  delete a community tag group
  """
  @spec delete_group(Community.t(), atom(), T.id()) ::
          {:ok, CommunityTagGroup.t()} | {:error, Ecto.Changeset.t()}
  def delete_group(community, thread, id), do: delete_group(community, thread, id, [])

  def delete_group(%Community{} = community, thread, id, opts) do
    with {:ok, community} <- ORM.find_by(Community, slug: community.slug),
         {:ok, group} <- find_group_in_thread(community, thread, id) do
      transact(fn ->
        with {:ok, deleted_group} <- delete_group_and_update_count(community, group),
             {:ok, _} <-
               invalidate_taxonomy(community, thread, "tag-group:delete:#{group.id}", opts) do
          deleted_group
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp delete_group_and_update_count(community, group) do
    case TagPersist.delete_group(group) do
      {:ok, deleted_group} ->
        case CMS.Communities.update_count_field(community, :community_tags_count) do
          {:ok, _} -> {:ok, deleted_group}
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
  def delete(id), do: delete(id, [])

  def delete(id, opts) do
    with {:ok, tag} <- FrontDesk.community_tag(id),
         {:ok, community} <- ORM.find(Community, tag.community_id) do
      transact(fn ->
        with {:ok, deleted_tag} <- TagPersist.delete_tag(tag),
             {:ok, _} <- CMS.Communities.update_count_field(community, :community_tags_count),
             {:ok, _} <- invalidate_taxonomy(community, tag.thread, "tag:delete:#{tag.id}", opts) do
          deleted_tag
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp do_update_tags_assoc(article, tags, opt, community_id, opts) when is_list(tags) do
    case Ecto.UUID.cast(Map.get(article, :id)) do
      {:ok, article_id} -> update_stable_tags(article, article_id, tags, opt, community_id, opts)
      :error -> {:error, :article_binding_context_required}
    end
  end

  defp update_stable_tags(article, article_id, tags, opt, community_id, opts)
       when is_integer(community_id) do
    case Repo.get_by(ArticleBinding, article_id: article_id, community_id: community_id) do
      %ArticleBinding{} = binding ->
        old_tags =
          CommunityTag
          |> join(:inner, [tag], assignment in CMS.Model.ArticleBindingTag,
            on: assignment.tag_id == tag.id
          )
          |> where([_tag, assignment], assignment.article_binding_id == ^binding.id)
          |> order_by([tag, _assignment], asc: tag.id)
          |> Repo.all()

        removing_ids = MapSet.new(tags, & &1.id)

        community_tags =
          case opt do
            :add -> Enum.uniq_by(old_tags ++ tags, & &1.id)
            :remove -> Enum.reject(old_tags, &MapSet.member?(removing_ids, &1.id))
            :overwrite -> tags
          end

        updated_article = Map.put(article, :community_tags, community_tags)

        with {:ok, _binding} <-
               BindingTags.replace(binding, Enum.map(community_tags, & &1.id)),
             {:ok, _} <- sync_tag_stats(updated_article, Repo.get!(Article, article_id), old_tags),
             {:ok, thread} <- FrontDesk.thread_of(article),
             {:ok, _} <-
               maybe_invalidate_taxonomy(
                 old_tags,
                 community_tags,
                 Repo.get!(Community, community_id),
                 thread,
                 "article-tags:#{binding.id}:#{:erlang.phash2(Enum.map(community_tags, & &1.id))}",
                 opts
               ) do
          {:ok, updated_article}
        end

      nil ->
        {:error, ErrorCat.not_exist("ArticleBinding")}
    end
  end

  defp update_stable_tags(_article, _article_id, _tags, _opt, _community_id, _opts),
    do: {:error, :article_binding_context_required}

  defp maybe_invalidate_taxonomy(old_tags, new_tags, community, thread, effect_key, opts) do
    old_ids = MapSet.new(old_tags, & &1.id)
    new_ids = MapSet.new(new_tags, & &1.id)

    if old_ids == new_ids do
      {:ok, :pass}
    else
      invalidate_taxonomy(community, thread, effect_key, opts)
    end
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
  def overwrite(community, thread, article, attrs),
    do: overwrite(community, thread, article, attrs, [])

  @spec overwrite(Community.t(), atom(), Ecto.Schema.t(), map(), keyword()) ::
          {:ok, Ecto.Schema.t()} | {:error, any()}
  def overwrite(%Community{id: cid}, thread, article, %{community_tags: tag_ids}, opts) do
    check_filter = %{community_id: cid, thread: thread}

    with {:ok, related_tags} <- find_related_tags(tag_ids, check_filter) do
      do_update_tags_assoc(article, related_tags, :overwrite, cid, opts)
    end
  end

  def set(community, thread, article, attrs), do: set(community, thread, article, attrs, [])

  def set(_, _, article, %{community_tags: []}, _opts), do: {:ok, article}

  def set(%Community{id: cid}, thread, article, %{community_tags: tag_ids}, opts) do
    check_filter = %{community_id: cid, thread: thread}

    with {:ok, related_tags} <- find_related_tags(tag_ids, check_filter) do
      do_update_tags_assoc(article, related_tags, :add, cid, opts)
    end
  end

  def set(_community, _thread, article, _, _opts), do: {:ok, article}

  @doc """
  add a tag to article
  """
  @spec add(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def add(article, tag_id), do: add(article, tag_id, [])

  def add(article, tag_id, opts) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, [tag], :add, tag.community_id, opts)
    end
  end

  @doc """
  remove a tag from article
  """
  @spec remove(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def remove(article, tag_id), do: remove(article, tag_id, [])

  def remove(article, tag_id, opts) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, [tag], :remove, tag.community_id, opts)
    end
  end

  defp sync_tag_stats(updated_article, article, old_tags) do
    new_tags = Map.get(updated_article, :community_tags, [])

    old_ids = MapSet.new(Enum.map(old_tags, & &1.id))
    new_ids = MapSet.new(Enum.map(new_tags, & &1.id))

    added_tags = Enum.reject(new_tags, &MapSet.member?(old_ids, &1.id))
    removed_tags = Enum.reject(old_tags, &MapSet.member?(new_ids, &1.id))

    deltas = Enum.map(added_tags, &{&1, 1}) ++ Enum.map(removed_tags, &{&1, -1})

    case TagStats.update_many(article, deltas) do
      {:ok, _result} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
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
  @spec reindex_in_group(Community.t(), atom(), T.id(), list(), keyword()) ::
          {:ok, atom()} | {:error, any()}
  def reindex_in_group(%Community{} = community, thread, group_id, indexed_tags) do
    reindex_in_group(community, thread, group_id, indexed_tags, [])
  end

  def reindex_in_group(community, thread, group_id, indexed_tags) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex_in_group(community, thread, group_id, indexed_tags, [])
    end
  end

  def reindex_in_group(%Community{} = community, thread, group_id, indexed_tags, opts) do
    with {:ok, group_tags} <- find_group_tags(community, thread, group_id),
         {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, false),
         {:ok, _} <- validate_complete_reindex(group_tags, indexed_tags) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex:group:#{group_id}:#{:erlang.phash2(indexed_tags)}",
        opts,
        fn -> batch_reindex_tags(community, thread, indexed_tags, false) end
      )
    end
  end

  @doc """
  reindex tags across groups
  """
  @spec reindex(Community.t(), atom(), list(), keyword()) :: {:ok, atom()} | {:error, any()}
  def reindex(%Community{} = community, thread, indexed_tags) do
    reindex(community, thread, indexed_tags, [])
  end

  def reindex(community, thread, indexed_tags) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex(community, thread, indexed_tags, [])
    end
  end

  def reindex(%Community{} = community, thread, indexed_tags, opts) do
    with {:ok, indexed_tags} <- normalize_indexed_tags(indexed_tags, true),
         {:ok, _} <- validate_indexed_tags(community, thread, indexed_tags),
         {:ok, _} <- validate_indexed_tags_groups(community, thread, indexed_tags) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex:#{:erlang.phash2(indexed_tags)}",
        opts,
        fn -> batch_reindex_tags(community, thread, indexed_tags, true) end
      )
    end
  end

  @doc """
  reindex tag groups
  """
  @spec reindex_groups(Community.t() | String.t(), atom(), list(), keyword()) ::
          {:ok, atom()} | {:error, any()}
  def reindex_groups(%Community{} = community, thread, indexed_groups) do
    reindex_groups(community, thread, indexed_groups, [])
  end

  def reindex_groups(community, thread, indexed_groups) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex_groups(community, thread, indexed_groups, [])
    end
  end

  def reindex_groups(%Community{} = community, thread, indexed_groups, opts) do
    with {:ok, indexed_groups} <- normalize_indexed_tags(indexed_groups, false),
         {:ok, _} <- validate_indexed_groups(community, thread, indexed_groups) do
      run_batch_reindex(
        community,
        thread,
        "tag:reindex-groups:#{:erlang.phash2(indexed_groups)}",
        opts,
        fn -> batch_reindex_groups(community, thread, indexed_groups) end
      )
    end
  end

  defp find_group_in_thread(%Community{} = community, thread, group_id, _group_title, _opts)
       when not is_nil(group_id) do
    find_group_in_thread(community, thread, group_id)
  end

  defp find_group_in_thread(%Community{} = community, thread, _group_id, group_title, opts)
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
          create_group(community, thread, %{title: title}, opts)
      end
    end
  end

  defp find_group_in_thread(_, _, _, _, _opts) do
    invalid_domain_tag("tag group required")
  end

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
      {:ok, :pass}
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
      {:ok, :pass}
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
      {:ok, :pass}
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
      {:ok, :pass}
    else
      invalid_domain_tag("tag group not in same community & thread")
    end
  end

  defp run_batch_reindex(community, thread, effect_key, opts, update_fun) do
    transact(fn ->
      case update_fun.() do
        {:ok, :pass} ->
          case invalidate_taxonomy(community, thread, effect_key, opts) do
            {:ok, _} -> :pass
            {:error, reason} -> Repo.rollback(reason)
          end

        {:error, reason} ->
          Repo.rollback(reason)
      end
    end)
  end

  defp batch_reindex_tags(community, thread, indexed_tags, include_group?) do
    TagPersist.batch_reindex_tags(community, thread, indexed_tags, include_group?)
    |> expect_updated_rows(length(indexed_tags))
  end

  defp batch_reindex_groups(community, thread, indexed_groups) do
    TagPersist.batch_reindex_groups(community, thread, indexed_groups)
    |> expect_updated_rows(length(indexed_groups))
  end

  defp expect_updated_rows({:ok, :pass}, 0), do: {:ok, :pass}
  defp expect_updated_rows({:ok, %{num_rows: expected}}, expected), do: {:ok, :pass}

  defp expect_updated_rows({:ok, _result}, _expected) do
    invalid_domain_tag("reindex target changed")
  end

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

  defp invalidate_taxonomy(%Community{} = community, thread, effect_key, opts) do
    with {:ok, identity} <- taxonomy_identity(community, thread, opts),
         {:ok, _event} <-
           CMS.Outbox.send(%{
             event: "community.taxonomy_changed",
             worker: CMS.Outbox.Workers.Community.Cleanup,
             resource_type: "community",
             resource_id: community.id,
             identity: identity,
             effect_key: effect_key,
             data: %{community: community.slug, community_id: community.id, thread: thread}
           }) do
      {:ok, :pass}
    end
  end

  defp invalidate_taxonomy_by_tag(tag, effect_key, opts) do
    community = Repo.get!(Community, tag.community_id)
    invalidate_taxonomy(community, tag.thread, effect_key, opts)
  end

  defp taxonomy_identity(%Community{}, _thread, opts) do
    case Keyword.get(opts, :identity) do
      {:command, command_id} when is_binary(command_id) ->
        {:ok, {:command, command_id}}

      {:workflow, workflow_ref} when is_binary(workflow_ref) and workflow_ref != "" ->
        {:ok, {:workflow, workflow_ref}}

      nil ->
        case Keyword.get(opts, :command_id) do
          command_id when is_binary(command_id) ->
            case Ecto.UUID.cast(command_id) do
              {:ok, command_id} -> {:ok, {:command, command_id}}
              :error -> {:error, :invalid_taxonomy_identity}
            end

          _ ->
            {:error, :taxonomy_identity_required}
        end

      _ ->
        {:error, :invalid_taxonomy_identity}
    end
  end

  defp split_identity(attrs, opts) when is_map(attrs) do
    command_id = Map.get(attrs, :command_id) || Map.get(attrs, "command_id")
    identity = Map.get(attrs, :identity) || Map.get(attrs, "identity")

    {Map.drop(attrs, [:command_id, "command_id", :identity, "identity"]),
     opts |> maybe_command_id(command_id) |> maybe_identity(identity)}
  end

  defp split_identity(attrs, opts), do: {attrs, opts}

  defp maybe_command_id(opts, nil), do: opts
  defp maybe_command_id(opts, command_id), do: Keyword.put(opts, :command_id, command_id)

  defp maybe_identity(opts, nil), do: opts
  defp maybe_identity(opts, identity), do: Keyword.put(opts, :identity, identity)

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

  # Gate/Command or an explicitly named maintenance workflow owns the
  # surrounding aggregate transaction. Tags never opens a transaction for a
  # caller, so an unclassified writer cannot silently become an owner.
  defp transact(fun) when is_function(fun, 0) do
    if Repo.in_transaction?(), do: {:ok, fun.()}, else: {:error, :tag_transaction_required}
  end

  defp invalid_domain_tag(details), do: {:error, ErrorCat.invalid_domain_tag(details)}
end
