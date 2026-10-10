defmodule GroupherServer.CMS.Articles.Numbering do
  @moduledoc """
  Allocates Community-wide public numbers for ArticleBinding bindings.

      Publish / Mirror / Move
        -> lock Community counter
        -> ArticleBinding.inner_id
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleBinding, CommunityInnerIdCounter}

  @doc "Assigns the next Community-wide number to an ArticleBinding binding."
  @spec assign_binding_inner_id(ArticleBinding.t()) ::
          {:ok, ArticleBinding.t()} | {:error, term()}
  def assign_binding_inner_id(%ArticleBinding{inner_id: inner_id} = binding)
      when is_integer(inner_id) do
    {:ok, binding}
  end

  def assign_binding_inner_id(%ArticleBinding{} = binding) do
    with {:ok, _counter} <- ensure_community_counter(binding.community_id),
         %CommunityInnerIdCounter{} = counter <- lock_community_counter(binding.community_id),
         {:ok, _counter} <- advance_community_counter(counter),
         {:ok, binding} <-
           binding
           |> ArticleBinding.changeset(%{inner_id: counter.next_inner_id})
           |> Repo.update() do
      {:ok, binding}
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
