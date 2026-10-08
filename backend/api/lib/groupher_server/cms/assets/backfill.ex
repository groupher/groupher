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

  @doc "Scans the new ownership table and writes a completion receipt only when it is valid."
  def run(%Community{id: community_id}, opts \\ []) do
    case Repo.transaction(fn ->
           {:ok, _} = Completeness.lock_scope(community_id)
           {:ok, _pending} = Completeness.mark_pending(community_id)

           if invalid_ref_exists?(community_id) do
             Repo.rollback(CMS.Assets.ErrorCat.custom("asset usage ownership is incomplete"))
           else
             {:ok, receipt} = Completeness.complete(community_id, opts)
             receipt
           end
         end) do
      {:ok, receipt} -> {:ok, receipt}
      {:error, reason} -> {:error, reason}
    end
  end

  defp invalid_ref_exists?(community_id) do
    Repo.exists?(
      from(ref in ArticleAssetRef,
        where:
          ref.community_id == ^community_id and
            ((is_nil(ref.body_draft_id) and is_nil(ref.revision_id)) or
               (not is_nil(ref.body_draft_id) and not is_nil(ref.revision_id)))
      )
    )
  end
end
