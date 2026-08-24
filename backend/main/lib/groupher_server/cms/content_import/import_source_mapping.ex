defmodule GroupherServer.CMS.ContentImport.ImportSourceMapping do
  @moduledoc """
  Owns versioned source/Groupher hash baselines for imported Docs.

      externalRef + source hash <-> Groupher Doc ref + rendered-content hash

  See `docs/bulk-import/content-import-architecture.md`.
  """

  alias GroupherServer.CMS.ContentImport.Persistence.ImportSourceMapping, as: Mapping
  alias GroupherServer.Repo

  @replace_fields [
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

  @row_fields [
    :connection_id,
    :external_ref,
    :groupher_hash,
    :inserted_at,
    :last_checked_at,
    :last_imported_at,
    :source_hash,
    :source_revision,
    :source_updated_at,
    :source_version,
    :thread,
    :thread_ref,
    :updated_at
  ]

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
    %Mapping{}
    |> Mapping.changeset(attrs)
    |> Repo.insert(
      conflict_target: [:connection_id, :thread, :external_ref],
      on_conflict: {:replace, @replace_fields},
      returning: true
    )
  end

  @doc "Batch upserts source mappings while preserving the single-row changeset contract."
  @spec upsert_all([map()]) :: :ok | {:error, Ecto.Changeset.t()}
  def upsert_all([]), do: :ok

  def upsert_all(attrs_list) when is_list(attrs_list) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    with {:ok, rows} <- rows(attrs_list, now) do
      Repo.insert_all(Mapping, rows,
        conflict_target: [:connection_id, :thread, :external_ref],
        on_conflict: {:replace, @replace_fields}
      )

      :ok
    end
  end

  defp rows(attrs_list, now) do
    Enum.reduce_while(attrs_list, {:ok, []}, fn attrs, {:ok, rows} ->
      attrs =
        attrs
        |> Map.put(:inserted_at, now)
        |> Map.put(:updated_at, now)

      case %Mapping{} |> Mapping.changeset(attrs) |> Ecto.Changeset.apply_action(:insert) do
        {:ok, _mapping} -> {:cont, {:ok, [Map.take(attrs, @row_fields) | rows]}}
        {:error, changeset} -> {:halt, {:error, changeset}}
      end
    end)
    |> case do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      error -> error
    end
  end
end
