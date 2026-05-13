defmodule GroupherServer.CMS.Communities.Tags do
  @moduledoc """
  community tags logic
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  import GroupherServer.CMS.Articles.Write,
    only: [ensure_author_exists: 1]

  import Helper.ErrorCode

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities.TagStats
  alias CMS.FrontDesk
  alias CMS.Model.{Community, CommunityTag, CommunityTagGroup}
  alias Helper.{Multi, ORM, QueryBuilder, T}

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
        case ORM.delete(group) do
          {:ok, deleted_group} ->
            case CMS.Communities.update_count_field(community, :community_tags_count) do
              {:ok, _} -> deleted_group
              {:error, reason} -> Repo.rollback(reason)
            end

          {:error, reason} ->
            Repo.rollback(reason)
        end
      end)
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

  # check if the tag to be set is in same community & thread
  defp tag_in_same_thread?(tag_ids, %{community_id: community_id, thread: thread}) do
    casted_tag_ids = Enum.map(tag_ids, &cast_id!/1)
    tag_ids = Enum.map(casted_tag_ids, &to_string/1)

    domain_tag_ids =
      CommunityTag
      |> where([t], t.community_id == ^community_id)
      |> where([t], t.thread == ^thread)
      |> where([t], t.id in ^casted_tag_ids)
      |> select([t], t.id)
      |> Repo.all()
      |> Enum.map(&to_string/1)

    Enum.sort(Enum.uniq(tag_ids)) === Enum.sort(domain_tag_ids)
  end

  defp do_overwrite_tags(article, tags) do
    article = Repo.preload(article, :community_tags)
    old_tags = article.community_tags

    Repo.transaction(fn ->
      with {:ok, updated_article} <-
             article
             |> Ecto.Changeset.change()
             |> Ecto.Changeset.put_assoc(:community_tags, tags)
             |> Repo.update(),
           {:ok, :pass} <- sync_tag_stats(updated_article, article, old_tags) do
        updated_article
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp find_related_tags(tag_ids) do
    FrontDesk.community_tags(tag_ids)
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

    if tag_in_same_thread?(tag_ids, check_filter) do
      with {:ok, article} <- do_overwrite_tags(article, []),
           {:ok, related_tags} <- find_related_tags(tag_ids) do
        do_overwrite_tags(article, related_tags)
      end
    else
      raise_error(:invalid_domain_tag, "tag not in same community & thread")
    end
  end

  def set(_, _, article, %{community_tags: []}), do: {:ok, article}

  def set(%Community{id: cid}, thread, article, %{
        community_tags: tag_ids
      }) do
    check_filter = %{community_id: cid, thread: thread}

    case tag_in_same_thread?(tag_ids, check_filter) do
      true ->
        Enum.each(tag_ids, &add(article, &1))
        {:ok, article}

      false ->
        raise_error(:invalid_domain_tag, "tag not in same community & thread")
    end
  end

  def set(_community, _thread, article, _), do: {:ok, article}

  @doc """
  add a tag to article
  """
  @spec add(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def add(article, tag_id) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, tag, :add)
    end
  end

  @doc """
  remove a tag from article
  """
  @spec remove(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def remove(article, tag_id) do
    with {:ok, tag} <- FrontDesk.community_tag(tag_id) do
      do_update_tags_assoc(article, tag, :remove)
    end
  end

  defp do_update_tags_assoc(article, %CommunityTag{} = tag, opt) do
    article = Repo.preload(article, :community_tags)
    old_tags = article.community_tags

    community_tags =
      case opt do
        :add -> (article.community_tags ++ [tag]) |> Enum.uniq_by(& &1.id)
        :remove -> article.community_tags -- [tag]
      end

    article
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
    |> then(fn changeset ->
      Repo.transaction(fn ->
        with {:ok, updated_article} <- Repo.update(changeset),
             {:ok, :pass} <- sync_tag_stats(updated_article, article, old_tags) do
          updated_article
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end)
  end

  defp sync_tag_stats(updated_article, article, old_tags) do
    new_tags = Map.get(updated_article, :community_tags, [])

    old_ids = MapSet.new(Enum.map(old_tags, & &1.id))
    new_ids = MapSet.new(Enum.map(new_tags, & &1.id))

    added_tags = Enum.reject(new_tags, &MapSet.member?(old_ids, &1.id))
    removed_tags = Enum.reject(old_tags, &MapSet.member?(new_ids, &1.id))

    with {:ok, :pass} <- update_stats(article, added_tags, :inc),
         {:ok, :pass} <- update_stats(article, removed_tags, :dec) do
      {:ok, :pass}
    end
  end

  defp update_stats(article, tags, action) do
    Enum.reduce_while(tags, {:ok, :pass}, fn tag, {:ok, :pass} ->
      case apply(TagStats, action, [article, tag]) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        error -> {:halt, error}
      end
    end)
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
    with {:ok, group_tags} <- find_group_tags(community, thread, group_id) do
      group_tags
      |> Enum.each(fn tag ->
        target =
          Enum.find(indexed_tags, fn t ->
            to_string(t.id) === to_string(tag.id)
          end)

        tag
        |> Ecto.Changeset.change(%{index: target.index})
        |> Repo.update()
      end)

      {:ok, :pass}
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
    ids = Enum.map(indexed_tags, & &1.id)

    with {:ok, indexed_tags} <- validate_indexed_tags_groups(community, thread, indexed_tags) do
      Repo.transaction(fn ->
        CommunityTag
        |> where([t], t.community_id == ^community.id)
        |> where([t], t.thread == ^thread)
        |> where([t], t.id in ^ids)
        |> Repo.all()
        |> Enum.each(fn tag ->
          target =
            Enum.find(indexed_tags, fn t ->
              to_string(t.id) === to_string(tag.id)
            end)

          tag
          |> Ecto.Changeset.change(%{group_id: target.group_id, index: target.index})
          |> Repo.update!()
        end)

        :pass
      end)
      |> result()
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
    ids = Enum.map(indexed_groups, & &1.id)

    Repo.transaction(fn ->
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^ids)
      |> Repo.all()
      |> Enum.each(fn group ->
        target =
          Enum.find(indexed_groups, fn g ->
            to_string(g.id) === to_string(group.id)
          end)

        group
        |> Ecto.Changeset.change(%{index: target.index})
        |> Repo.update!()
      end)

      :pass
    end)
    |> result()
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
      raise_error(:invalid_domain_tag, "tag group required")
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
    do: raise_error(:invalid_domain_tag, "tag group required")

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
      _ -> raise_error(:invalid_domain_tag, "tag group not in same community & thread")
    end
  end

  defp normalize_update_attrs(%CommunityTag{} = tag, attrs) do
    attrs = Map.drop(attrs, [:group])

    case Map.get(attrs, :group_id) do
      nil ->
        {:ok, attrs}

      group_id ->
        with {:ok, _group} <- find_group_in_thread(%Community{id: tag.community_id}, tag.thread, group_id) do
          {:ok, attrs}
        end
    end
  end

  defp validate_indexed_tags_groups(%Community{} = community, thread, indexed_tags) do
    group_ids =
      indexed_tags
      |> Enum.map(&cast_id!(&1.group_id))
      |> Enum.uniq()

    valid_group_ids =
      CommunityTagGroup
      |> where([g], g.community_id == ^community.id)
      |> where([g], g.thread == ^thread)
      |> where([g], g.id in ^group_ids)
      |> select([g], g.id)
      |> Repo.all()
      |> MapSet.new()

    if Enum.all?(group_ids, &MapSet.member?(valid_group_ids, &1)) do
      indexed_tags =
        Enum.map(indexed_tags, fn tag ->
          %{tag | group_id: cast_id!(tag.group_id)}
        end)

      {:ok, indexed_tags}
    else
      raise_error(:invalid_domain_tag, "tag group not in same community & thread")
    end
  end

  defp cast_id!(id) do
    case Ecto.Type.cast(:id, id) do
      {:ok, casted_id} -> casted_id
      :error -> raise_error(:invalid_domain_tag, "invalid tag group id")
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
end
