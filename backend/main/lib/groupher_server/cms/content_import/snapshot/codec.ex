defmodule GroupherServer.CMS.ContentImport.Snapshot.Codec do
  @moduledoc "Versioned JSON codec for durable domain Snapshot payloads."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry, Snapshot}

  @version 1

  @spec version() :: pos_integer()
  def version, do: @version

  @spec dump(Snapshot.t()) :: {:ok, binary()} | {:error, Diagnostic.t()}
  def dump(%Snapshot{} = snapshot) do
    snapshot
    |> encode()
    |> Jason.encode()
    |> case do
      {:ok, binary} -> {:ok, binary}
      {:error, reason} -> codec_error("snapshot_payload_encode_failed", reason)
    end
  end

  @spec load(binary()) :: {:ok, Snapshot.t()} | {:error, Diagnostic.t()}
  def load(binary) when is_binary(binary) do
    with {:ok, payload} <- decode_json(binary),
         :ok <- validate_envelope(payload),
         {:ok, entries} <- decode_entries(payload["entries"]),
         {:ok, fetched_at} <- parse_datetime(payload["fetchedAt"], "fetchedAt"),
         {:ok, platform} <- existing_atom(payload["platform"], "platform"),
         {:ok, snapshot} <-
           Snapshot.new(%{
             platform: platform,
             source_ref: payload["sourceRef"],
             revision: payload["revision"],
             checkpoint: payload["checkpoint"],
             entries: entries,
             fetched_at: fetched_at,
             adapter_version: payload["adapterVersion"],
             diagnostics: payload["diagnostics"] || []
           }),
         :ok <- verify_manifest(snapshot, payload["manifestHash"]) do
      {:ok, snapshot}
    end
  end

  def load(_binary),
    do: Diagnostic.error_result("invalid_snapshot_payload", "Snapshot payload must be binary")

  defp encode(snapshot) do
    %{
      "type" => "content_import_snapshot",
      "version" => @version,
      "platform" => Atom.to_string(snapshot.platform),
      "sourceRef" => snapshot.source_ref,
      "revision" => snapshot.revision,
      "checkpoint" => snapshot.checkpoint,
      "fetchedAt" => DateTime.to_iso8601(snapshot.fetched_at),
      "adapterVersion" => snapshot.adapter_version,
      "manifestHash" => snapshot.manifest_hash,
      "entries" => Enum.map(snapshot.entries, &encode_entry/1),
      "diagnostics" => snapshot.diagnostics
    }
  end

  defp encode_entry(entry) do
    %{
      "externalRef" => entry.external_ref,
      "kind" => Atom.to_string(entry.kind),
      "path" => entry.path,
      "title" => entry.title,
      "body" => encode_body(entry.kind, entry.body),
      "bodyFormat" => encode_atom(entry.body_format),
      "metadata" => entry.metadata,
      "sourceUrl" => entry.source_url,
      "sourceUpdatedAt" => encode_datetime(entry.source_updated_at),
      "revision" => entry.revision,
      "contentHash" => entry.content_hash
    }
  end

  defp encode_body(_kind, nil), do: nil

  defp encode_body(:asset, body) when is_binary(body),
    do: %{"encoding" => "base64", "value" => Base.encode64(body)}

  defp encode_body(_kind, body) when is_binary(body) do
    if String.valid?(body),
      do: %{"encoding" => "utf8", "value" => body},
      else: %{"encoding" => "base64", "value" => Base.encode64(body)}
  end

  defp encode_body(_kind, body), do: %{"encoding" => "json", "value" => body}

  defp decode_entries(entries) when is_list(entries) do
    Enum.reduce_while(entries, {:ok, []}, fn payload, {:ok, decoded} ->
      case decode_entry(payload) do
        {:ok, entry} -> {:cont, {:ok, [entry | decoded]}}
        {:error, diagnostic} -> {:halt, {:error, diagnostic}}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp decode_entries(_entries),
    do: Diagnostic.error_result("invalid_snapshot_entries", "Snapshot entries must be a list")

  defp decode_entry(payload) when is_map(payload) do
    with {:ok, kind} <- existing_atom(payload["kind"], "entry kind"),
         {:ok, body} <- decode_body(payload["body"]),
         {:ok, body_format} <- optional_atom(payload["bodyFormat"], "body format"),
         {:ok, source_updated_at} <-
           optional_datetime(payload["sourceUpdatedAt"], "sourceUpdatedAt"),
         {:ok, entry} <-
           Entry.new(%{
             external_ref: payload["externalRef"],
             kind: kind,
             path: payload["path"],
             title: payload["title"],
             body: body,
             body_format: body_format,
             metadata: payload["metadata"] || %{},
             source_url: payload["sourceUrl"],
             source_updated_at: source_updated_at,
             revision: payload["revision"]
           }),
         :ok <- verify_entry_hash(entry, payload["contentHash"]) do
      {:ok, entry}
    end
  end

  defp decode_entry(_payload),
    do: Diagnostic.error_result("invalid_snapshot_entry", "Snapshot entry must be a map")

  defp decode_body(nil), do: {:ok, nil}
  defp decode_body(%{"encoding" => "utf8", "value" => body}) when is_binary(body), do: {:ok, body}
  defp decode_body(%{"encoding" => "json", "value" => body}), do: {:ok, body}

  defp decode_body(%{"encoding" => "base64", "value" => body}) when is_binary(body) do
    case Base.decode64(body) do
      {:ok, decoded} ->
        {:ok, decoded}

      :error ->
        Diagnostic.error_result("invalid_snapshot_body", "Snapshot base64 body is invalid")
    end
  end

  defp decode_body(_body),
    do: Diagnostic.error_result("invalid_snapshot_body", "Snapshot body encoding is invalid")

  defp validate_envelope(%{"type" => "content_import_snapshot", "version" => @version}), do: :ok

  defp validate_envelope(_payload) do
    Diagnostic.error_result(
      "unsupported_snapshot_payload",
      "Snapshot payload type or version is not supported"
    )
  end

  defp verify_manifest(snapshot, expected) when snapshot.manifest_hash == expected, do: :ok

  defp verify_manifest(_snapshot, _expected) do
    Diagnostic.error_result(
      "snapshot_payload_hash_mismatch",
      "Snapshot payload does not match its manifest hash"
    )
  end

  defp verify_entry_hash(entry, expected) when entry.content_hash == expected, do: :ok

  defp verify_entry_hash(_entry, _expected) do
    Diagnostic.error_result(
      "snapshot_entry_hash_mismatch",
      "Snapshot Entry payload does not match its content hash"
    )
  end

  defp decode_json(binary) do
    case Jason.decode(binary) do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> codec_error("snapshot_payload_decode_failed", reason)
    end
  end

  defp parse_datetime(value, field) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> {:ok, datetime}
      _ -> Diagnostic.error_result("invalid_snapshot_datetime", "Snapshot #{field} is invalid")
    end
  end

  defp parse_datetime(_value, field),
    do: Diagnostic.error_result("invalid_snapshot_datetime", "Snapshot #{field} is required")

  defp optional_datetime(nil, _field), do: {:ok, nil}
  defp optional_datetime(value, field), do: parse_datetime(value, field)

  defp existing_atom(value, field) when is_binary(value) do
    {:ok, String.to_existing_atom(value)}
  rescue
    ArgumentError ->
      Diagnostic.error_result("invalid_snapshot_atom", "Snapshot #{field} is not supported")
  end

  defp existing_atom(_value, field),
    do: Diagnostic.error_result("invalid_snapshot_atom", "Snapshot #{field} is required")

  defp optional_atom(nil, _field), do: {:ok, nil}
  defp optional_atom(value, field), do: existing_atom(value, field)

  defp encode_atom(nil), do: nil
  defp encode_atom(value), do: Atom.to_string(value)

  defp encode_datetime(nil), do: nil
  defp encode_datetime(value), do: DateTime.to_iso8601(value)

  defp codec_error(code, reason),
    do: Diagnostic.error_result(code, "Snapshot payload codec failed", details: inspect(reason))
end
