defmodule GroupherServer.CMS.Wallpaper.RequestDigest do
  @moduledoc """
  Owns versioned Wallpaper request canonicalization and digest calculation.

  Batch creation, publish verification, and Receipt replay must all call this
  module so a request digest version has exactly one implementation.

  Publish request -> canonical JSON -> request digest -> capability and Receipt
  verification.
  """

  @active_version 1

  @spec active_version() :: pos_integer()
  def active_version, do: @active_version

  @spec digest(map()) :: String.t() | {:error, {:unsupported_request_digest_version, term()}}
  def digest(input) when is_map(input) do
    case canonical(input) do
      canonical when is_binary(canonical) ->
        hash = :crypto.hash(:sha256, canonical) |> Base.encode16(case: :lower)
        "sha256:" <> hash

      {:error, _reason} = error ->
        error
    end
  end

  @spec canonical(map()) :: binary() | {:error, {:unsupported_request_digest_version, term()}}
  def canonical(%{
        community_id: community_id,
        base_version: base_version,
        settings: settings,
        theme: theme,
        request_digest_version: @active_version
      }) do
    GroupherServer.CMS.CanonicalJSON.encode(%{
      "baseVersion" => base_version,
      "communityId" => community_id,
      "settings" => settings,
      "theme" => theme
    })
  end

  def canonical(%{request_digest_version: version}) do
    {:error, {:unsupported_request_digest_version, version}}
  end

  def canonical(_input), do: {:error, {:unsupported_request_digest_version, nil}}
end
