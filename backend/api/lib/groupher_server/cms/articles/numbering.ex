defmodule GroupherServer.CMS.Articles.Numbering do
  @moduledoc """
  Allocates Community-wide public numbers for ArticleCommunity relations.

      Publish / Mirror / Move
        -> lock Community counter
        -> ArticleCommunity.inner_id
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleCommunity, CommunityInnerIdCounter}

  @doc "Assigns the next Community-wide number to an ArticleCommunity relation."
  @spec assign_relation_inner_id(ArticleCommunity.t()) ::
          {:ok, ArticleCommunity.t()} | {:error, term()}
  def assign_relation_inner_id(%ArticleCommunity{inner_id: inner_id} = relation)
      when is_integer(inner_id) do
    {:ok, relation}
  end

  def assign_relation_inner_id(%ArticleCommunity{} = relation) do
    with {:ok, _counter} <- ensure_community_counter(relation.community_id),
         %CommunityInnerIdCounter{} = counter <- lock_community_counter(relation.community_id),
         {:ok, _counter} <- advance_community_counter(counter),
         {:ok, relation} <-
           relation
           |> ArticleCommunity.changeset(%{inner_id: counter.next_inner_id})
           |> Repo.update() do
      {:ok, relation}
    else
      nil -> {:error, :community_inner_id_counter_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_community_counter(community_id) do
    %CommunityInnerIdCounter{}
    |> CommunityInnerIdCounter.changeset(%{community_id: community_id, next_inner_id: 1})
    |> Repo.insert(on_conflict: :nothing, conflict_target: [:community_id])
  end

  defp lock_community_counter(community_id) do
    CommunityInnerIdCounter
    |> where([counter], counter.community_id == ^community_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp advance_community_counter(counter) do
    counter
    |> CommunityInnerIdCounter.changeset(%{next_inner_id: counter.next_inner_id + 1})
    |> Repo.update()
  end
end
