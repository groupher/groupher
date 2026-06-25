defmodule GroupherServer.CMS.DocCover.Sync do
  @moduledoc """
  Publish-time cover synchronization.

      publish doc
          |
          v
      published group/page
          |
          +-- ensure doc_cover_groups(group)
          |
          +-- ensure doc_cover_items(page)

  Existing cover rows are never reset here. In particular, cover-local
  `hidden` stays untouched so "hide from cover" survives future publishes.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocCoverGroup, DocCoverItem, DocTreeNode}
  alias Helper.{ORM, T}

  @doc """
  Ensures one published page is present in its cover group.
  """
  @spec sync_published_page(Community.t(), DocTreeNode.t(), DocTreeNode.t()) ::
          T.domain_res(term())
  def sync_published_page(
        %Community{} = community,
        %DocTreeNode{type: :group} = published_group,
        %DocTreeNode{type: :page} = published_page
      ) do
    with {:ok, cover_group} <- ensure_cover_group(community, published_group),
         {:ok, _item} <- ensure_cover_item(community, cover_group, published_page) do
      {:ok, :synced}
    end
  end

  def sync_published_page(_community, _group, _node), do: {:ok, :skipped}

  @doc """
  Ensures a published group has a cover section.
  """
  @spec ensure_cover_group(Community.t(), DocTreeNode.t()) :: T.domain_res(DocCoverGroup.t())
  def ensure_cover_group(%Community{} = community, %DocTreeNode{type: :group} = group) do
    case ORM.find_by(DocCoverGroup, community_id: community.id, group_id: group.id) do
      {:ok, cover_group} ->
        {:ok, cover_group}

      {:error, _} ->
        attrs = %{
          community_id: community.id,
          group_id: group.id,
          index: next_group_index(community)
        }

        create_or_find(
          DocCoverGroup,
          attrs,
          [community_id: community.id, group_id: group.id],
          :group_id
        )
    end
  end

  @doc """
  Ensures a published page has a cover item under the given cover group.
  """
  @spec ensure_cover_item(Community.t(), DocCoverGroup.t(), DocTreeNode.t()) ::
          T.domain_res(DocCoverItem.t())
  def ensure_cover_item(
        %Community{} = community,
        %DocCoverGroup{} = cover_group,
        %DocTreeNode{type: :page} = page
      ) do
    case ORM.find_by(DocCoverItem, cover_group_id: cover_group.id, node_id: page.id) do
      {:ok, item} ->
        {:ok, item}

      {:error, _} ->
        attrs = %{
          community_id: community.id,
          cover_group_id: cover_group.id,
          node_id: page.id,
          index: next_item_index(cover_group)
        }

        create_or_find(
          DocCoverItem,
          attrs,
          [cover_group_id: cover_group.id, node_id: page.id],
          :node_id
        )
    end
  end

  defp create_or_find(schema, attrs, lookup, unique_field) do
    case insert_with_savepoint(schema, attrs) do
      {:ok, row} ->
        {:ok, row}

      {:error, %Ecto.Changeset{} = changeset} ->
        if unique_constraint_error?(changeset, unique_field) do
          ORM.find_by(schema, lookup)
        else
          {:error, changeset}
        end
    end
  end

  defp insert_with_savepoint(schema, attrs) do
    schema
    |> struct()
    |> schema.changeset(attrs)
    |> Repo.insert(mode: :savepoint)
  end

  defp unique_constraint_error?(%Ecto.Changeset{errors: errors}, field) do
    Enum.any?(errors, fn
      {^field, {_message, opts}} -> opts[:constraint] == :unique
      _ -> false
    end)
  end

  defp next_group_index(%Community{} = community) do
    DocCoverGroup
    |> where([g], g.community_id == ^community.id)
    |> select([g], max(g.index))
    |> Repo.one()
    |> next_index()
  end

  defp next_item_index(%DocCoverGroup{} = cover_group) do
    DocCoverItem
    |> where([i], i.cover_group_id == ^cover_group.id)
    |> select([i], max(i.index))
    |> Repo.one()
    |> next_index()
  end

  defp next_index(nil), do: 0
  defp next_index(index), do: index + 1
end
