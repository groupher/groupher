defmodule GroupherServer.CMS.Assets.GeneratedBatch.PublishCapability do
  @moduledoc """
  Owns the generated-image publish capability wire contract shared with Assets Hub.

  Assets Hub camelCase payload
    -> signature verification and strict decoding
    -> canonical Phoenix snake_case payload

  Canonical Phoenix manifest
    -> stable camelCase wire bytes
    -> shared manifest digest
  """

  alias GroupherServer.CMS

  alias CMS.Assets.Capability

  @purpose "generated_image_publish"

  @spec verify(String.t()) :: {:ok, map()} | {:error, :invalid_publish_capability}
  def verify(token) when is_binary(token) do
    with {:ok, payload} <- Capability.verify(token),
         {:ok, manifest} <- parse_manifest(payload["manifest"]),
         true <- payload["purpose"] == @purpose,
         {:ok, expires_at, _offset} <- parse_datetime(payload["expiresAt"]),
         true <- DateTime.compare(expires_at, DateTime.utc_now()) == :gt,
         {:ok, capability} <- canonical_payload(payload, manifest, expires_at) do
      {:ok, capability}
    else
      _ -> {:error, :invalid_publish_capability}
    end
  end

  def verify(_token), do: {:error, :invalid_publish_capability}

  @doc "Returns the v1 canonical manifest bytes shared with Assets Hub."
  @spec canonical_manifest([map()]) :: binary()
  def canonical_manifest(manifest) when is_list(manifest) do
    manifest
    |> Enum.sort_by(&Map.fetch!(&1, :variant_key))
    |> Enum.map(&manifest_wire_entry/1)
    |> GroupherServer.CMS.CanonicalJSON.encode()
  end

  @doc "Returns the v1 digest of the canonical camelCase manifest wire encoding."
  @spec manifest_digest([map()]) :: String.t()
  def manifest_digest(manifest) when is_list(manifest) do
    digest = :crypto.hash(:sha256, canonical_manifest(manifest)) |> Base.encode16(case: :lower)
    "sha256:" <> digest
  end

  defp canonical_payload(payload, manifest, expires_at) do
    capability = %{
      batch_ref: payload["batchRef"],
      claim_key: payload["claimKey"],
      expires_at: expires_at,
      manifest: manifest,
      manifest_digest: payload["manifestDigest"],
      policy_version: payload["policyVersion"],
      purpose: payload["purpose"],
      request_digest: payload["requestDigest"],
      request_digest_version: payload["requestDigestVersion"],
      signing_key_id: payload["signingKeyId"]
    }

    if valid_payload?(capability), do: {:ok, capability}, else: {:error, :invalid_payload}
  end

  defp valid_payload?(payload) do
    Enum.all?(
      [
        payload.batch_ref,
        payload.claim_key,
        payload.manifest_digest,
        payload.policy_version,
        payload.request_digest,
        payload.signing_key_id
      ],
      &(is_binary(&1) and String.trim(&1) != "")
    ) and is_integer(payload.request_digest_version)
  end

  defp parse_manifest(manifest) when is_list(manifest) do
    manifest
    |> Enum.reduce_while({:ok, []}, fn entry, {:ok, parsed} ->
      case parse_manifest_entry(entry) do
        {:ok, value} -> {:cont, {:ok, [value | parsed]}}
        :error -> {:halt, :error}
      end
    end)
    |> case do
      {:ok, parsed} -> {:ok, Enum.reverse(parsed)}
      :error -> :error
    end
  end

  defp parse_manifest(_manifest), do: :error

  defp parse_manifest_entry(entry) when is_map(entry) do
    parsed = %{
      asset_public_ref: entry["assetPublicRef"],
      candidate_owner_ref: entry["candidateOwnerRef"],
      checksum: entry["checksum"],
      height: entry["height"],
      mime_type: entry["mimeType"],
      storage_key: entry["storageKey"],
      variant_key: entry["variantKey"],
      width: entry["width"]
    }

    if valid_manifest_entry?(parsed), do: {:ok, parsed}, else: :error
  end

  defp parse_manifest_entry(_entry), do: :error

  defp valid_manifest_entry?(entry) do
    Enum.all?(
      [
        entry.asset_public_ref,
        entry.candidate_owner_ref,
        entry.checksum,
        entry.mime_type,
        entry.storage_key,
        entry.variant_key
      ],
      &(is_binary(&1) and String.trim(&1) != "")
    ) and is_integer(entry.width) and entry.width > 0 and is_integer(entry.height) and
      entry.height > 0
  end

  defp manifest_wire_entry(entry) do
    %{
      "assetPublicRef" => Map.fetch!(entry, :asset_public_ref),
      "candidateOwnerRef" => Map.fetch!(entry, :candidate_owner_ref),
      "checksum" => Map.fetch!(entry, :checksum),
      "height" => Map.fetch!(entry, :height),
      "mimeType" => Map.fetch!(entry, :mime_type),
      "storageKey" => Map.fetch!(entry, :storage_key),
      "variantKey" => Map.fetch!(entry, :variant_key),
      "width" => Map.fetch!(entry, :width)
    }
  end

  defp parse_datetime(value) when is_binary(value), do: DateTime.from_iso8601(value)
  defp parse_datetime(_value), do: :error
end
