defmodule GroupherServer.CMS.Assets.Upload do
  @moduledoc """
  Issues short-lived asset upload capabilities and records trusted completions.

  Phoenix owns the business boundary: community permission, stable public refs,
  canonical URLs, and final DB writes. The assets-hub service owns R2 signing and
  object verification, then calls back through a scoped service mutation.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Upload
        -> Repo / Assets Hub
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{
    Repo
  }

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Assets.{Capability, Writer}
  alias GroupherServer.CMS.Model.{Community, CommunityAsset}
  alias Helper.{T, Utils}

  @allowed_mime_types ~w(image/jpeg image/png image/webp image/gif)
  @max_size_bytes 10 * 1024 * 1024
  @storage_limit_bytes 100 * 1024 * 1024
  @capability_ttl_seconds 15 * 60

  @doc """
  Creates a short-lived upload capability intent for one community asset.

  The intent validates the file metadata, checks the community storage quota,
  and returns a signed capability plus the canonical object key and URL.

  ## Examples

      Upload.create_intent(community, %{filename: "hero.png", mime_type: "image/png", size_bytes: 1024}, user)
      #=> {:ok, %{upload_ref: "upload_...", asset_public_ref: "asset_...", capability: "..."}}

  """
  @spec create_intent(Community.t(), map(), User.t()) :: T.domain_res(map())
  def create_intent(%Community{} = community, file, %User{} = user) when is_map(file) do
    with {:ok, attrs} <- validate_file(file),
         :ok <- ensure_capacity(community.id, attrs.size_bytes) do
      issued_at = DateTime.utc_now(:second)
      upload_ref = "upload_" <> Utils.uid(18)
      asset_uid = Utils.uid(18)
      asset_public_ref = "asset_" <> asset_uid
      object_key = original_object_key(community.slug, issued_at, asset_uid)
      canonical_url = "#{Capability.public_endpoint()}/a/#{asset_public_ref}/original"
      expires_at = DateTime.add(issued_at, @capability_ttl_seconds, :second)

      # Capability payload is the signed handoff from Phoenix to assets-hub.
      # Example values:
      #   uploadRef: upload_abc, assetPublicRef: asset_abc
      #   objectKey: communities/groupher/assets/2026_07/29_abc/original
      #   canonicalUrl: https://assets.groupher.com/a/asset_abc/original
      #
      # Phoenix derives these fields from the authenticated community/user plus
      # validated file metadata. assets-hub later verifies this exact payload
      # before issuing the R2 PUT URL or finalizing the upload.
      payload = %{
        "purpose" => "asset.upload",
        "uploadRef" => upload_ref,
        "assetPublicRef" => asset_public_ref,
        "communityId" => community.id,
        "communitySlug" => community.slug,
        "uploaderId" => user.id,
        "objectKey" => object_key,
        "canonicalUrl" => canonical_url,
        "declaredFilename" => attrs.filename,
        "declaredMimeType" => attrs.mime_type,
        "declaredSizeBytes" => attrs.size_bytes,
        "declaredAssetType" => attrs.asset_type,
        "declaredThread" => attrs.thread,
        "checksumSha256" => attrs.checksum_sha256,
        "allowedMimeTypes" => @allowed_mime_types,
        "maxSizeBytes" => @max_size_bytes,
        "expiresAt" => DateTime.to_iso8601(expires_at)
      }

      {:ok,
       %{
         upload_ref: upload_ref,
         asset_public_ref: asset_public_ref,
         object_key: object_key,
         capability: Capability.sign(payload),
         expires_at: expires_at,
         max_size_bytes: @max_size_bytes,
         allowed_mime_types: @allowed_mime_types
       }}
    end
  end

  @spec complete(map()) :: T.domain_res(CommunityAsset.t())
  def complete(input) when is_map(input) do
    attrs = %{
      public_ref: get(input, :asset_public_ref),
      url: get(input, :url),
      storage: get(input, :storage),
      storage_key: get(input, :storage_key),
      content_hash: get(input, :content_hash),
      size_bytes: get(input, :size_bytes),
      filename: get(input, :filename),
      mime_type: get(input, :mime_type),
      thread: get(input, :thread) || :post,
      asset_type: get(input, :asset_type) || :file,
      width: get(input, :width),
      height: get(input, :height),
      meta: get(input, :meta) || %{},
      uploader_id: get(input, :uploader_id)
    }

    with :ok <- validate_completion(attrs) do
      Repo.transaction(fn ->
        case input |> get(:community_id) |> normalize_id() do
          nil ->
            Repo.rollback(
              GroupherServer.ErrorCat.custom("community asset storage quota exceeded")
            )

          community_id ->
            lock_community!(community_id)

            complete_asset(community_id, attrs)
        end
      end)
    end
  end

  defp complete_asset(community_id, attrs) do
    with :ok <- ensure_capacity(community_id, attrs.size_bytes),
         {:ok, asset} <- Writer.register(%Community{id: community_id}, attrs, nil) do
      asset
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp validate_file(file) do
    filename = file |> get(:filename) |> normalize_string()
    mime_type = file |> get(:mime_type) |> normalize_string()
    size_bytes = get(file, :size_bytes)
    checksum_sha256 = file |> get(:checksum_sha256) |> normalize_string()
    asset_type = get(file, :asset_type) || asset_type_from_mime(mime_type)
    thread = get(file, :thread) || :post

    cond do
      filename == nil ->
        {:error, GroupherServer.ErrorCat.custom("filename is required")}

      mime_type not in @allowed_mime_types ->
        {:error, GroupherServer.ErrorCat.custom("unsupported asset MIME type")}

      not is_integer(size_bytes) or size_bytes <= 0 ->
        {:error, GroupherServer.ErrorCat.custom("size_bytes must be positive")}

      size_bytes > @max_size_bytes ->
        {:error, GroupherServer.ErrorCat.custom("asset is larger than v1 upload limit")}

      checksum_sha256 != nil and not base64_sha256?(checksum_sha256) ->
        {:error,
         GroupherServer.ErrorCat.custom("checksum_sha256 must be a base64 SHA-256 digest")}

      not valid_thread?(thread) ->
        {:error, GroupherServer.ErrorCat.custom("asset thread is invalid")}

      true ->
        {:ok,
         %{
           filename: filename,
           mime_type: mime_type,
           size_bytes: size_bytes,
           checksum_sha256: checksum_sha256,
           asset_type: asset_type,
           thread: normalize_thread(thread)
         }}
    end
  end

  defp validate_completion(attrs) do
    cond do
      not is_binary(attrs.public_ref) or not String.starts_with?(attrs.public_ref, "asset_") ->
        {:error, GroupherServer.ErrorCat.custom("asset_public_ref is invalid")}

      not is_binary(attrs.content_hash) or not String.starts_with?(attrs.content_hash, "sha256:") ->
        {:error, GroupherServer.ErrorCat.custom("content_hash must use sha256:<hex>")}

      not is_integer(attrs.size_bytes) or attrs.size_bytes <= 0 ->
        {:error, GroupherServer.ErrorCat.custom("size_bytes must be positive")}

      true ->
        :ok
    end
  end

  defp ensure_capacity(community_id, incoming_size_bytes)
       when is_integer(incoming_size_bytes) do
    case normalize_id(community_id) do
      nil ->
        {:error, GroupherServer.ErrorCat.custom("community asset storage quota exceeded")}

      community_id ->
        used_bytes =
          community_id
          |> CommunityAsset.active_query()
          |> select([asset], coalesce(sum(asset.size_bytes), 0))
          |> Repo.one()

        if storage_bytes_to_integer(used_bytes) + incoming_size_bytes <= @storage_limit_bytes do
          :ok
        else
          {:error, GroupherServer.ErrorCat.custom("community asset storage quota exceeded")}
        end
    end
  end

  defp ensure_capacity(_, _),
    do: {:error, GroupherServer.ErrorCat.custom("community asset storage quota exceeded")}

  defp normalize_id(value) when is_integer(value), do: value

  defp normalize_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} -> id
      _ -> nil
    end
  end

  defp normalize_id(_), do: nil

  defp storage_bytes_to_integer(%Decimal{} = value), do: Decimal.to_integer(value)
  defp storage_bytes_to_integer(value) when is_integer(value), do: value

  defp lock_community!(community_id) do
    Community
    |> where([community], community.id == ^community_id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  end

  defp original_object_key(community_slug, %DateTime{} = issued_at, asset_uid) do
    %{day: day, month: month, year: year} = DateTime.to_date(issued_at)
    month_path = "#{year}_#{pad2(month)}"
    dated_name = "#{pad2(day)}_#{asset_uid}"

    "communities/#{community_slug}/assets/#{month_path}/#{dated_name}/original"
  end

  defp pad2(value) when is_integer(value),
    do: value |> Integer.to_string() |> String.pad_leading(2, "0")

  defp asset_type_from_mime("image/" <> _), do: :image
  defp asset_type_from_mime(_), do: :file

  defp valid_thread?(thread), do: match?({:ok, _}, Threads.to_atom(thread))

  defp normalize_thread(thread) do
    {:ok, thread} = Threads.to_atom(thread)
    thread
  end

  defp base64_sha256?(value) do
    case Base.decode64(value) do
      {:ok, digest} -> byte_size(digest) == 32
      :error -> false
    end
  end

  defp get(map, key) when is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp normalize_string(value) when is_binary(value) do
    value = String.trim(value)
    if value == "", do: nil, else: value
  end

  defp normalize_string(_), do: nil
end
