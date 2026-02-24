defmodule GroupherServer.CMS.Communities.Tags do
  @moduledoc """
  community tags logic
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, atom_values_to_upcase: 1]

  import GroupherServer.CMS.Articles.Write,
    only: [ensure_author_exists: 1]

  import ShortMaps
  import Helper.ErrorCode

  alias GroupherServer.{Accounts, Repo}
  alias Helper.Types, as: T
  alias Helper.{ORM, QueryBuilder}

  alias GroupherServer.CMS
  alias Accounts.Model.User

  alias CMS.Model.{Community, CommunityTag}

  alias Ecto.Multi

  @doc """
  create a community tag
  """
  @spec create(Community.t(), atom(), map(), User.t()) ::
          {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def create(%Community{} = community, thread, attrs, %User{
        id: user_id
      }) do
    with {:ok, author} <- ensure_author_exists(%User{id: user_id}),
         {:ok, community} <- ORM.find_by(Community, slug: community.slug) do
      Multi.new()
      |> Multi.run(:create_tag, fn _, _ ->
        update_attrs = %{
          author_id: author.id,
          community_id: community.id,
          thread: thread
        }

        attrs = attrs |> Map.merge(update_attrs) |> atom_values_to_upcase

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
    with {:ok, tag} <- ORM.find(CommunityTag, id) do
      attrs = attrs |> atom_values_to_upcase
      ORM.update(tag, attrs)
    end
  end

  @doc """
  delete a community tag
  """
  @spec delete(T.id()) :: {:ok, CommunityTag.t()} | {:error, Ecto.Changeset.t()}
  def delete(id) do
    with {:ok, tag} <- ORM.find(CommunityTag, id),
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
  defp tag_in_same_thread?(tag_ids, filter) do
    case paged(filter) do
      {:ok, paged_tags} ->
        domain_tags_ids = Enum.map(paged_tags.entries, &to_string(&1.id))
        tag_ids = Enum.map(tag_ids, &to_string(&1))

        Enum.all?(tag_ids, &Enum.member?(domain_tags_ids, &1))

      _ ->
        false
    end
  end

  defp do_overwrite_tags(article, tags) do
    article
    |> Repo.preload(:community_tags)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:community_tags, tags)
    |> Repo.update()
  end

  defp find_related_tags(tag_ids) do
    tags =
      from(t in CommunityTag)
      |> where([t], t.id in ^tag_ids)
      |> Repo.all()

    pos =
      tag_ids
      |> Enum.with_index()
      |> Map.new(fn {id, idx} -> {to_string(id), idx} end)

    tags
    |> Enum.sort_by(&Map.get(pos, to_string(&1.id), 9_999_999))
    |> done()
  end

  @doc """
  set tags by list of tag_ids (overwrite)
  """
  @spec overwrite(Community.t(), atom(), Ecto.Schema.t(), map()) ::
          {:ok, Ecto.Schema.t()} | {:error, any()}
  def overwrite(%Community{id: cid}, thread, article, %{
        community_tags: tag_ids
      }) do
    check_filter = %{page: 1, size: 100, community_id: cid, thread: thread}

    with true <- tag_in_same_thread?(tag_ids, check_filter),
         {:ok, article} <- do_overwrite_tags(article, []),
         {:ok, related_tags} <- find_related_tags(tag_ids) do
      do_overwrite_tags(article, related_tags)
    else
      false ->
        raise_error(:invalid_domain_tag, "tag not in same community & thread")
    end
  end

  def set(_, _, article, %{community_tags: []}), do: {:ok, article}

  def set(%Community{id: cid}, thread, article, %{
        community_tags: tag_ids
      }) do
    check_filter = %{page: 1, size: 100, community_id: cid, thread: thread}

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
    with {:ok, tag} <- ORM.find(CommunityTag, tag_id) do
      do_update_tags_assoc(article, tag, :add)
    end
  end

  @doc """
  remove a tag from article
  """
  @spec remove(Ecto.Schema.t(), T.id()) :: {:ok, Ecto.Schema.t()} | {:error, any()}
  def remove(article, tag_id) do
    with {:ok, tag} <- ORM.find(CommunityTag, tag_id) do
      do_update_tags_assoc(article, tag, :remove)
    end
  end

  defp do_update_tags_assoc(article, %CommunityTag{} = tag, opt) do
    article = Repo.preload(article, :community_tags)

    community_tags =
      case opt do
        :add -> (article.community_tags ++ [tag]) |> Enum.uniq_by(& &1.id)
        :remove -> article.community_tags -- [tag]
      end

    article
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
    |> Repo.update()
  end

  @doc """
  get all paged tags
  """
  @spec paged(map()) :: {:ok, map()} | {:error, any()}
  def paged(%{page: page, size: size} = filter) do
    CommunityTag
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  def paged(filter) do
    CommunityTag
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> ORM.paginator(%{page: 1, size: 100})
    |> done()
  end

  @doc """
  reindex tags in spec group
  """
  @spec reindex_in_group(Community.t(), atom(), atom(), list()) :: {:ok, atom()} | {:error, any()}
  def reindex_in_group(%Community{} = community, thread, group, indexed_tags) do
    with {:ok, group_tags} <- find_group_tags(community, thread, group) do
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

  def reindex_in_group(community, thread, group, indexed_tags) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      reindex_in_group(community, thread, group, indexed_tags)
    end
  end

  defp find_group_tags(%Community{} = community, thread, group) do
    filter = %{community: community.slug, thread: thread} |> atom_values_to_upcase

    CommunityTag
    |> where([t], t.group == ^group)
    |> QueryBuilder.filter_pack(replace_community_ifneed(filter))
    |> Repo.all()
    |> done
  end

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
  defp result({:error, _, result, _steps}), do: {:error, result}
end
