defmodule GroupherServer.CMS.ContentImport.ImportSourceMapping do
  @moduledoc """
  Owns versioned source/Groupher hash baselines for imported Docs.

      externalRef + source hash <-> Groupher Doc ref + rendered-content hash

  See `docs/bulk-import/content-import-architecture.md`.
  """

  alias GroupherServer.Repo
  alias GroupherServer.CMS.ContentImport.Persistence.ImportSourceMapping, as: Mapping

  @doc "Hashes the canonical body, title, and slug into the Groupher-side sync baseline."
  @spec groupher_hash(String.t(), String.t(), String.t()) :: String.t()
  def groupher_hash(body_hash, title, slug) do
    digest =
      :sha256
      |> :crypto.hash(
        :erlang.term_to_binary({:doc_sync_v1, body_hash, title, slug}, [:deterministic])
      )
      |> Base.encode16(case: :lower)

    "doc-sync-v1:" <> digest
  end

  @doc "Upserts the last successful mapping for one connection/thread/externalRef identity."
  @spec upsert(map()) :: {:ok, Mapping.t()} | {:error, Ecto.Changeset.t()}
  def upsert(attrs) do
    replace_fields = [
      :thread_ref,
      :source_revision,
      :source_version,
      :source_hash,
      :groupher_hash,
      :source_updated_at,
      :last_checked_at,
      :last_imported_at,
      :updated_at
    ]

    %Mapping{}
    |> Mapping.changeset(attrs)
    |> Repo.insert(
      conflict_target: [:connection_id, :thread, :external_ref],
      on_conflict: {:replace, replace_fields},
      returning: true
    )
  end
end
