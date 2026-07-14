defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Preparation.Codec do
  @moduledoc "Versioned JSON codec for durable Doc Preparation payloads."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Snapshot}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.Preparation

  @version 1

  @spec dump(Preparation.t()) :: {:ok, binary()} | {:error, Diagnostic.t()}
  def dump(%Preparation{} = preparation) do
    %{
      "type" => "content_import_doc_preparation",
      "version" => preparation.version,
      "snapshotManifestHash" => preparation.snapshot_manifest_hash,
      "framework" => Atom.to_string(preparation.framework),
      "sourceTree" => preparation.source_tree,
      "preparationHash" => preparation.preparation_hash,
      "diagnostics" => preparation.diagnostics
    }
    |> Jason.encode()
    |> case do
      {:ok, binary} -> {:ok, binary}
      {:error, reason} -> codec_error("doc_preparation_encode_failed", reason)
    end
  end

  @spec load(binary(), Snapshot.t()) :: {:ok, Preparation.t()} | {:error, Diagnostic.t()}
  def load(binary, %Snapshot{} = snapshot) when is_binary(binary) do
    with {:ok, payload} <- decode_json(binary),
         :ok <- validate_envelope(payload),
         :ok <- validate_snapshot_hash(payload, snapshot),
         {:ok, framework} <- framework(payload["framework"]),
         {:ok, preparation} <-
           Preparation.new(
             snapshot,
             framework,
             payload["sourceTree"],
             payload["diagnostics"] || []
           ),
         :ok <- validate_preparation_hash(payload, preparation) do
      {:ok, preparation}
    end
  end

  def load(_binary, %Snapshot{}),
    do:
      Diagnostic.error_result(
        "invalid_doc_preparation_payload",
        "Preparation payload must be binary"
      )

  defp validate_envelope(%{
         "type" => "content_import_doc_preparation",
         "version" => @version
       }),
       do: :ok

  defp validate_envelope(_payload) do
    Diagnostic.error_result(
      "unsupported_doc_preparation_payload",
      "Doc Preparation payload type or version is not supported"
    )
  end

  defp validate_snapshot_hash(%{"snapshotManifestHash" => hash}, snapshot)
       when hash == snapshot.manifest_hash,
       do: :ok

  defp validate_snapshot_hash(_payload, _snapshot) do
    Diagnostic.error_result(
      "doc_preparation_snapshot_mismatch",
      "Doc Preparation does not belong to the supplied Snapshot"
    )
  end

  defp validate_preparation_hash(%{"preparationHash" => hash}, preparation)
       when hash == preparation.preparation_hash,
       do: :ok

  defp validate_preparation_hash(_payload, _preparation) do
    Diagnostic.error_result(
      "doc_preparation_hash_mismatch",
      "Doc Preparation payload does not match its hash"
    )
  end

  defp framework(value) when is_binary(value) do
    {:ok, String.to_existing_atom(value)}
  rescue
    ArgumentError ->
      Diagnostic.error_result(
        "invalid_doc_preparation_framework",
        "Doc Preparation framework is not supported"
      )
  end

  defp framework(_value) do
    Diagnostic.error_result(
      "invalid_doc_preparation_framework",
      "Doc Preparation framework is required"
    )
  end

  defp decode_json(binary) do
    case Jason.decode(binary) do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> codec_error("doc_preparation_decode_failed", reason)
    end
  end

  defp codec_error(code, reason),
    do:
      Diagnostic.error_result(code, "Doc Preparation payload codec failed",
        details: inspect(reason)
      )
end
