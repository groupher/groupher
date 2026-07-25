defmodule GroupherServer.CMS.DocCover.Sync do
  @moduledoc """
  Cover Card persistence helpers.

  Cards are explicitly selected Groups. Publishing a Page must never create a
  Card implicitly; the read projection derives current Card items from the
  published navigation tree.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocCoverCard, DocTreeNode}
  alias Helper.{ORM, T}

  @doc """
  Keeps the publish hook stable without implicitly creating Cover Cards.
  """
  @spec sync_published_page(Community.t(), DocTreeNode.t(), DocTreeNode.t()) ::
          T.domain_res(term())
  def sync_published_page(_community, _group, _node), do: {:ok, :skipped}

  @doc """
  Ensures a published Group has one persisted Cover Card row.
  """
  @spec ensure_cover_card(Community.t(), DocTreeNode.t()) :: T.domain_res(DocCoverCard.t())
  def ensure_cover_card(
        %Community{} = community,
        %DocTreeNode{type: :group} = group_node
      ) do
    case ORM.find_by(
           DocCoverCard,
           community_id: community.id,
           group_node_id: group_node.id
         ) do
      {:ok, cover_card} ->
        {:ok, cover_card}

      {:error, _} ->
        attrs = %{
          community_id: community.id,
          group_node_id: group_node.id,
          index: next_group_index(community)
        }

        create_or_find(
          DocCoverCard,
          attrs,
          [community_id: community.id, group_node_id: group_node.id],
          :group_node_id
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
    changeset =
      schema
      |> struct()
      |> schema.changeset(attrs)

    # Savepoints let a surrounding transaction recover from unique races, but
    # Ecto raises when `mode: :savepoint` is used outside a transaction.
    if Repo.in_transaction?() do
      Repo.insert(changeset, mode: :savepoint)
    else
      Repo.insert(changeset)
    end
  end

  defp unique_constraint_error?(%Ecto.Changeset{errors: errors}, field) do
    Enum.any?(errors, fn
      {^field, {_message, opts}} -> opts[:constraint] == :unique
      _ -> false
    end)
  end

  defp next_group_index(%Community{} = community) do
    DocCoverCard
    |> where([g], g.community_id == ^community.id)
    |> select([g], max(g.index))
    |> Repo.one()
    |> next_index()
  end

  defp next_index(nil), do: 0
  defp next_index(index), do: index + 1
end
