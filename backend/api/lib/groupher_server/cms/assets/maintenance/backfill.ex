defmodule GroupherServer.CMS.Assets.Backfill do
  @moduledoc """
  Rebuilds and receipts the authoritative version-owned asset usage scope.

  Business position:

      community maintenance job
        -> Assets.Backfill
        -> pending fence -> refs scan -> completion receipt
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Assets.Completeness
  alias CMS.Model.{ArticleAssetRef, Community}

  @doc """
  Scans the ownership table and writes a completion receipt only when it is valid.

  The scope is locked for the whole transaction. An invalid reference rolls back
  the pending fence, so a later maintenance run can retry the same community.

  ## Examples

      Backfill.run(%Community{id: 1})
      #=> {:ok, receipt} | {:error, reason}
  """
  @spec run(Community.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def run(%Community{id: community_id}, opts \\ []) do
    Repo.transact_result(fn ->
      with {:ok, _} <- Completeness.lock_scope(community_id),
           {:ok, _pending} <- Completeness.mark_pending(community_id),
           {:ok, :pass} <- valid_refs(community_id),
           {:ok, receipt} <- Completeness.complete(community_id, opts) do
        {:ok, receipt}
      end
    end)
  end

  defp valid_refs(community_id) do
    if invalid_ref_exists?(community_id) do
      {:error, CMS.Assets.ErrorCat.custom("asset usage ownership is incomplete")}
    else
      {:ok, :pass}
    end
  end

  defp invalid_ref_exists?(community_id) do
    Repo.exists?(
      from(ref in ArticleAssetRef,
        where:
          ref.community_id == ^community_id and
            fragment(
              "num_nonnulls(?, ?, ?, ?) <> 1",
              ref.body_draft_id,
              ref.revision_id,
              ref.working_copy_id,
              ref.snapshot_id
            )
      )
    )
  end
end
