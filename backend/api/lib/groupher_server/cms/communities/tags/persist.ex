defmodule GroupherServer.CMS.Communities.Tags.Persist do
  @moduledoc """
  Persistence primitives for community tags and tag groups.

  This module deliberately owns only database row operations. Admission,
  transactions, command identity, taxonomy effects, and community count policy
  remain with the concrete command or the legacy maintenance workflow that
  calls these primitives.

      concrete Command / maintenance workflow
        -> Tags.Persist
        -> cms.community_tags / cms.community_tag_groups
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.{Community, CommunityTag, CommunityTagGroup}
  alias Helper.{Datetime, ORM}

  @doc "Inserts one tag row with its already-normalized aggregate attributes."
  @spec create_tag(Community.t(), atom(), map(), pos_integer(), pos_integer()) ::
          {:ok, CommunityTag.t()} | {:error, term()}
  def create_tag(%Community{id: community_id}, thread, attrs, author_id, group_id) do
    attrs =
      Map.merge(attrs, %{
        author_id: author_id,
        community_id: community_id,
        group_id: group_id,
        thread: thread
      })

    ORM.create(CommunityTag, attrs)
  end

  @doc "Updates one canonical tag row and preloads its aggregate associations."
  @spec update_tag(CommunityTag.t(), map()) :: {:ok, CommunityTag.t()} | {:error, term()}
  def update_tag(%CommunityTag{} = tag, attrs) do
    with {:ok, updated} <- ORM.update(tag, attrs) do
      {:ok, Repo.preload(updated, [:community, :tag_group])}
    end
  end

  @doc "Inserts one tag group row with its already-normalized index."
  @spec create_group(Community.t(), atom(), map(), integer()) ::
          {:ok, CommunityTagGroup.t()} | {:error, term()}
  def create_group(%Community{id: community_id}, thread, attrs, index) do
    attrs = Map.merge(attrs, %{community_id: community_id, thread: thread, index: index})
    ORM.create(CommunityTagGroup, attrs)
  end

  @doc "Updates one canonical tag group and preloads its member tags."
  @spec update_group(CommunityTagGroup.t(), map()) ::
          {:ok, CommunityTagGroup.t()} | {:error, term()}
  def update_group(%CommunityTagGroup{} = group, attrs) do
    with {:ok, updated} <- ORM.update(group, attrs) do
      {:ok, Repo.preload(updated, tags: [:community, :tag_group])}
    end
  end

  @doc "Deletes one tag group row."
  @spec delete_group(CommunityTagGroup.t()) ::
          {:ok, CommunityTagGroup.t()} | {:error, term()}
  def delete_group(%CommunityTagGroup{} = group), do: ORM.delete(group)

  @doc "Deletes one tag row."
  @spec delete_tag(CommunityTag.t()) :: {:ok, CommunityTag.t()} | {:error, term()}
  def delete_tag(%CommunityTag{} = tag), do: ORM.delete(tag)

  @doc """
  Batch updates tag indexes and optional group moves.

  Uses [`Ecto.Query.values/2`](https://hexdocs.pm/ecto/Ecto.Query.API.html#values/2)
  as typed in-memory update rows and [`Ecto.Repo.update_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#update_all/3)
  to apply every row's distinct values in one statement.
  """
  @spec batch_reindex_tags(Community.t(), atom(), [map()], boolean()) ::
          {:ok, non_neg_integer()} | {:error, term()}
  def batch_reindex_tags(_community, _thread, [], _include_group?), do: {:ok, :pass}

  def batch_reindex_tags(%Community{} = community, thread, indexed_tags, include_group?) do
    now = Datetime.now(:second)

    if include_group? do
      updates =
        Enum.map(indexed_tags, fn tag ->
          %{id: tag.id, group_id: tag.group_id, index: tag.index}
        end)

      query =
        from(tag in CommunityTag,
          join: update in values(updates, %{id: :id, group_id: :id, index: :integer}),
          on: update.id == tag.id,
          where: tag.community_id == ^community.id,
          where: tag.thread == ^thread,
          update: [set: [group_id: update.group_id, index: update.index, updated_at: ^now]]
        )

      update_all(query)
    else
      updates = Enum.map(indexed_tags, fn tag -> %{id: tag.id, index: tag.index} end)

      query =
        from(tag in CommunityTag,
          join: update in values(updates, %{id: :id, index: :integer}),
          on: update.id == tag.id,
          where: tag.community_id == ^community.id,
          where: tag.thread == ^thread,
          update: [set: [index: update.index, updated_at: ^now]]
        )

      update_all(query)
    end
  end

  @doc """
  Batch updates tag-group indexes.

  Uses [`Ecto.Query.values/2`](https://hexdocs.pm/ecto/Ecto.Query.API.html#values/2)
  and [`Ecto.Repo.update_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#update_all/3)
  to apply every group's distinct index in one statement.
  """
  @spec batch_reindex_groups(Community.t(), atom(), [map()]) ::
          {:ok, non_neg_integer()} | {:error, term()}
  def batch_reindex_groups(_community, _thread, []), do: {:ok, :pass}

  def batch_reindex_groups(%Community{} = community, thread, indexed_groups) do
    updates = Enum.map(indexed_groups, fn group -> %{id: group.id, index: group.index} end)
    now = Datetime.now(:second)

    query =
      from(tag_group in CommunityTagGroup,
        join: update in values(updates, %{id: :id, index: :integer}),
        on: update.id == tag_group.id,
        where: tag_group.community_id == ^community.id,
        where: tag_group.thread == ^thread,
        update: [set: [index: update.index, updated_at: ^now]]
      )

    update_all(query)
  end

  defp update_all(query) do
    {count, _result} = Repo.update_all(query, [])
    {:ok, count}
  end
end
