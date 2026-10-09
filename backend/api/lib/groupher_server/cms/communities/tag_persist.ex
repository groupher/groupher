defmodule GroupherServer.CMS.Communities.TagPersist do
  @moduledoc """
  Persistence primitives for community tags and tag groups.

  This module deliberately owns only database row operations. Admission,
  transactions, command identity, taxonomy effects, and community count policy
  remain with the concrete command or the legacy maintenance workflow that
  calls these primitives.

      concrete Command / maintenance workflow
        -> TagPersist
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

  @doc "Runs the SQL batch update for tag indexes (and optional group moves)."
  @spec batch_reindex_tags(Community.t(), atom(), [map()], boolean()) ::
          {:ok, term()} | {:error, term()}
  def batch_reindex_tags(_community, _thread, [], _include_group?), do: {:ok, :pass}

  def batch_reindex_tags(%Community{} = community, thread, indexed_tags, include_group?) do
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

    Repo.query(query, params)
  end

  @doc "Runs the SQL batch update for tag-group indexes."
  @spec batch_reindex_groups(Community.t(), atom(), [map()]) ::
          {:ok, term()} | {:error, term()}
  def batch_reindex_groups(_community, _thread, []), do: {:ok, :pass}

  def batch_reindex_groups(%Community{} = community, thread, indexed_groups) do
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

    Repo.query(query, [ids, indexes, community.id, Atom.to_string(thread), Datetime.now(:second)])
  end
end
