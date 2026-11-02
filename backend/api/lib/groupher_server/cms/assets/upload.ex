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

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.ErrorCat

  alias Accounts.Model.User
  alias CMS.Assets.{Capability, Persist, ThreadIdentity}
  alias CMS.Model.{AssetUpload, Community, CommunityAsset}
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
      # returns an intent map containing `upload_ref`, `asset_public_ref`, `capability`, and `expires_at`

  """
  @spec create_intent(Community.t(), map(), User.t()) :: T.domain_res(map())
  def create_intent(%Community{} = community, file, %User{} = user) when is_map(file) do
    with {:ok, attrs} <- validate_file(file),
         {:ok, _} <- ensure_capacity(community.id, attrs.size_bytes) do
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

      with {:ok, _upload} <-
             persist_intent(
               community,
               user,
               "asset.upload",
               upload_ref,
               payload,
               attrs,
               expires_at
             ) do
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
  end

  @doc "Creates a generated-image upload capability bound to one Wallpaper Batch target."
  @spec create_generated_intent(Community.t(), map(), User.t()) :: T.domain_res(map())
  def create_generated_intent(%Community{} = community, file, %User{} = user) when is_map(file) do
    with {:ok, attrs} <- validate_file(file),
         {:ok, generated} <- validate_generated_file(file),
         {:ok, _} <- ensure_capacity(community.id, attrs.size_bytes) do
      issued_at = DateTime.utc_now(:second)
      upload_ref = "upload_" <> Utils.uid(18)
      asset_uid = Utils.uid(18)
      asset_public_ref = "asset_" <> asset_uid
      object_key = generated_object_key(community.slug, generated.batch_ref, asset_uid)
      canonical_url = "#{Capability.public_endpoint()}/a/#{asset_public_ref}/original"
      expires_at = DateTime.add(issued_at, @capability_ttl_seconds, :second)

      payload = %{
        "purpose" => "generated_image",
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
        "declaredAssetType" => "image",
        "declaredThread" => "post",
        "declaredWidth" => generated.width,
        "declaredHeight" => generated.height,
        "batchRef" => generated.batch_ref,
        "candidateOwnerRef" => generated.candidate_owner_ref,
        "variantKey" => generated.variant_key,
        "checksumSha256" => attrs.checksum_sha256,
        "allowedMimeTypes" => ["image/webp"],
        "maxSizeBytes" => @max_size_bytes,
        "expiresAt" => DateTime.to_iso8601(expires_at)
      }

      with {:ok, _upload} <-
             persist_intent(
               community,
               user,
               "generated_image",
               upload_ref,
               payload,
               attrs,
               expires_at
             ) do
        {:ok,
         %{
           upload_ref: upload_ref,
           asset_public_ref: asset_public_ref,
           object_key: object_key,
           capability: Capability.sign(payload),
           expires_at: expires_at,
           max_size_bytes: @max_size_bytes,
           allowed_mime_types: ["image/webp"]
         }}
      end
    end
  end

  @spec complete(map()) :: T.domain_res(CommunityAsset.t())
  def complete(input) when is_map(input) do
    upload_ref = input |> get(:upload_ref) |> normalize_string()
    idempotency_key = input |> get(:idempotency_key) |> normalize_string()

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

    with {:ok, upload} <- load_upload(upload_ref, idempotency_key) do
      case validate_completion(upload, input, attrs) do
        {:ok, :pass} ->
          complete_loaded(upload, attrs)

        {:error, reason} ->
          _ = record_callback_failure(upload, reason)
          {:error, reason}
      end
    end
  end

  defp complete_loaded(%AssetUpload{} = upload, attrs) do
    result =
      Repo.transaction(fn ->
        upload = lock_upload!(upload.id)
        community_id = upload.community_id
        lock_community!(community_id)

        case upload.state do
          :completed ->
            load_completed_asset!(upload)

          :expired ->
            Repo.rollback(ErrorCat.custom("asset upload intent expired"))

          :failed ->
            Repo.rollback(
              ErrorCat.custom(upload.failure_message || "asset upload completion failed")
            )

          :pending ->
            complete_asset(upload, attrs)
        end
      end)

    case result do
      {:ok, asset} ->
        {:ok, asset}

      {:error, reason} = error ->
        _ = record_callback_failure(upload, reason)
        error
    end
  end

  defp complete_asset(%AssetUpload{} = upload, attrs) do
    with {:ok, _} <- ensure_capacity(upload.community_id, attrs.size_bytes),
         {:ok, asset} <-
           Persist.register(
             %Community{id: upload.community_id},
             Map.put(attrs, :uploader_id, upload.uploader_id),
             nil
           ),
         {:ok, _upload} <-
           upload
           |> AssetUpload.changeset(%{
             asset_id: asset.id,
             state: :completed,
             completion: completion_payload(asset),
             callback_attempts: upload.callback_attempts + 1,
             completed_at: DateTime.utc_now(:second),
             last_callback_at: DateTime.utc_now(:second),
             failure_code: nil,
             failure_message: nil
           })
           |> Repo.update() do
      asset
    else
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp persist_intent(community, user, purpose, upload_ref, payload, attrs, expires_at) do
    Repo.transaction(fn ->
      lock_community!(community.id)

      case ensure_capacity(community.id, attrs.size_bytes) do
        {:ok, :pass} -> {:ok, :pass}
        {:error, reason} -> Repo.rollback(reason)
      end

      upload_attrs = %{
        upload_ref: upload_ref,
        idempotency_key: upload_ref,
        purpose: purpose,
        community_id: community.id,
        uploader_id: user.id,
        asset_public_ref: payload["assetPublicRef"],
        object_key: payload["objectKey"],
        canonical_url: payload["canonicalUrl"],
        declared_filename: attrs.filename,
        declared_mime_type: attrs.mime_type,
        declared_size_bytes: attrs.size_bytes,
        declared_asset_type: to_string(attrs.asset_type),
        declared_thread: to_string(attrs.thread),
        declared_checksum_sha256: attrs.checksum_sha256,
        capability_expires_at: expires_at,
        state: :pending,
        completion: %{},
        callback_attempts: 0
      }

      case %AssetUpload{} |> AssetUpload.changeset(upload_attrs) |> Repo.insert() do
        {:ok, upload} -> upload
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp load_upload(upload_ref, idempotency_key)
       when is_binary(upload_ref) and is_binary(idempotency_key) do
    case Repo.get_by(AssetUpload, upload_ref: upload_ref, idempotency_key: idempotency_key) do
      %AssetUpload{} = upload -> {:ok, upload}
      nil -> {:error, ErrorCat.custom("asset upload intent not found")}
    end
  end

  defp load_upload(_, _), do: {:error, ErrorCat.custom("asset upload identity is required")}

  defp record_callback_failure(%AssetUpload{id: upload_id}, reason) do
    Repo.transaction(fn ->
      upload = lock_upload!(upload_id)

      if upload.state == :pending do
        now = DateTime.utc_now(:second)
        expired? = DateTime.compare(upload.capability_expires_at, now) == :lt

        changes = %{
          state: if(expired?, do: :expired, else: :failed),
          failure_code: if(expired?, do: "expired", else: "completion_rejected"),
          failure_message:
            if(expired?, do: "asset upload intent expired", else: failure_message(reason)),
          callback_attempts: upload.callback_attempts + 1,
          last_callback_at: now
        }

        case Repo.update(AssetUpload.changeset(upload, changes)) do
          {:ok, updated} -> updated
          {:error, update_reason} -> Repo.rollback(update_reason)
        end
      else
        upload
      end
    end)
  end

  defp failure_message(%{details: details}) when is_binary(details), do: details
  defp failure_message(reason), do: inspect(reason)

  defp lock_upload!(id) do
    AssetUpload
    |> where([upload], upload.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  end

  defp load_completed_asset!(%AssetUpload{asset_id: asset_id}) when is_integer(asset_id) do
    case Repo.get(CommunityAsset, asset_id) do
      %CommunityAsset{} = asset -> asset
      nil -> Repo.rollback(ErrorCat.command_result_unavailable())
    end
  end

  defp load_completed_asset!(_upload), do: Repo.rollback(ErrorCat.command_result_unavailable())

  defp validate_completion(%AssetUpload{} = upload, input, attrs) do
    with {:ok, :pass} <- validate_completion(attrs),
         {:ok, :pass} <- validate_bound_fact(upload, :asset_public_ref, attrs.public_ref),
         {:ok, :pass} <-
           validate_bound_fact(upload, :community_id, normalize_id(get(input, :community_id))),
         {:ok, :pass} <- validate_bound_fact(upload, :storage_key, attrs.storage_key),
         {:ok, :pass} <- validate_bound_fact(upload, :url, attrs.url),
         {:ok, :pass} <- validate_declared_size(upload, attrs.size_bytes),
         {:ok, :pass} <- validate_declared_mime(upload, attrs.mime_type),
         {:ok, :pass} <- validate_declared_asset_type(upload, attrs.asset_type),
         {:ok, :pass} <- validate_declared_thread(upload, attrs.thread),
         {:ok, :pass} <- validate_declared_uploader(upload, get(input, :uploader_id)) do
      if upload.state == :pending and
           DateTime.compare(upload.capability_expires_at, DateTime.utc_now(:second)) == :lt do
        {:error, ErrorCat.custom("asset upload intent expired")}
      else
        {:ok, :pass}
      end
    end
  end

  defp validate_bound_fact(%AssetUpload{asset_public_ref: expected}, :asset_public_ref, actual) do
    compare_bound(expected, actual, "asset public ref does not match upload intent")
  end

  defp validate_bound_fact(%AssetUpload{community_id: expected}, :community_id, actual) do
    compare_bound(expected, actual, "community does not match upload intent")
  end

  defp validate_bound_fact(%AssetUpload{object_key: expected}, :storage_key, actual) do
    compare_bound(expected, actual, "storage key does not match upload intent")
  end

  defp validate_bound_fact(%AssetUpload{canonical_url: expected}, :url, actual) do
    compare_bound(expected, actual, "asset URL does not match upload intent")
  end

  defp compare_bound(expected, actual, _message) when expected == actual, do: {:ok, :pass}
  defp compare_bound(_expected, _actual, message), do: {:error, ErrorCat.custom(message)}

  defp validate_declared_size(%AssetUpload{declared_size_bytes: expected}, actual) do
    compare_bound(expected, actual, "asset size does not match upload intent")
  end

  defp validate_declared_mime(%AssetUpload{declared_mime_type: nil}, _actual), do: {:ok, :pass}

  defp validate_declared_mime(%AssetUpload{declared_mime_type: expected}, actual) do
    compare_bound(expected, actual, "asset MIME type does not match upload intent")
  end

  defp validate_declared_asset_type(%AssetUpload{declared_asset_type: expected}, actual) do
    compare_bound(expected, to_string(actual), "asset type does not match upload intent")
  end

  defp validate_declared_thread(%AssetUpload{declared_thread: expected}, actual) do
    compare_bound(expected, to_string(actual), "asset thread does not match upload intent")
  end

  defp validate_declared_uploader(%AssetUpload{uploader_id: nil}, _actual), do: {:ok, :pass}

  defp validate_declared_uploader(%AssetUpload{uploader_id: expected}, actual) do
    compare_bound(expected, normalize_id(actual), "asset uploader does not match upload intent")
  end

  defp completion_payload(%CommunityAsset{} = asset) do
    %{
      "assetId" => asset.id,
      "publicRef" => asset.public_ref,
      "status" => Atom.to_string(asset.status),
      "completedAt" => DateTime.to_iso8601(DateTime.utc_now(:second))
    }
  end

  defp validate_file(file) do
    attrs = normalize_file(file)

    with {:ok, :pass} <- validate_filename(attrs.filename),
         {:ok, :pass} <- validate_mime_type(attrs.mime_type),
         {:ok, :pass} <- validate_size(attrs.size_bytes),
         {:ok, :pass} <- validate_checksum(attrs.checksum_sha256),
         {:ok, :pass} <- validate_thread(attrs.thread) do
      {:ok, %{attrs | thread: normalize_thread(attrs.thread)}}
    end
  end

  defp normalize_file(file) do
    mime_type = file |> get(:mime_type) |> normalize_string()

    %{
      filename: file |> get(:filename) |> normalize_string(),
      mime_type: mime_type,
      size_bytes: get(file, :size_bytes),
      checksum_sha256: file |> get(:checksum_sha256) |> normalize_string(),
      asset_type: get(file, :asset_type) || asset_type_from_mime(mime_type),
      thread: get(file, :thread) || :post
    }
  end

  defp validate_filename(nil), do: {:error, ErrorCat.custom("filename is required")}
  defp validate_filename(_filename), do: {:ok, :pass}

  defp validate_mime_type(mime_type) when mime_type in @allowed_mime_types, do: {:ok, :pass}

  defp validate_mime_type(_mime_type) do
    {:error, ErrorCat.custom("unsupported asset MIME type")}
  end

  defp validate_size(size_bytes) when not is_integer(size_bytes) or size_bytes <= 0 do
    {:error, ErrorCat.custom("size_bytes must be positive")}
  end

  defp validate_size(size_bytes) when size_bytes > @max_size_bytes do
    {:error, ErrorCat.custom("asset is larger than v1 upload limit")}
  end

  defp validate_size(_size_bytes), do: {:ok, :pass}

  defp validate_checksum(nil), do: {:ok, :pass}

  defp validate_checksum(checksum) when is_binary(checksum) do
    if base64_sha256?(checksum) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("checksum_sha256 must be a base64 SHA-256 digest")}
    end
  end

  defp validate_thread(thread) do
    if valid_thread?(thread) do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("asset thread is invalid")}
    end
  end

  defp validate_generated_file(file) do
    batch_ref = file |> get(:batch_ref) |> normalize_string()
    candidate_owner_ref = file |> get(:candidate_owner_ref) |> normalize_string()
    variant_key = file |> get(:variant_key) |> normalize_string()
    width = get(file, :width)
    height = get(file, :height)
    mime_type = file |> get(:mime_type) |> normalize_string()

    with {:ok, :pass} <- validate_generated_mime(mime_type),
         {:ok, :pass} <- validate_generated_dimensions(width, height),
         {:ok, :pass} <- validate_generated_metadata(batch_ref, candidate_owner_ref, variant_key) do
      {:ok,
       %{
         batch_ref: batch_ref,
         candidate_owner_ref: candidate_owner_ref,
         height: height,
         variant_key: variant_key,
         width: width
       }}
    end
  end

  defp validate_generated_mime("image/webp"), do: {:ok, :pass}

  defp validate_generated_mime(_mime_type) do
    {:error, ErrorCat.custom("generated image MIME type must be image/webp")}
  end

  defp validate_generated_dimensions(width, height)
       when is_integer(width) and width > 0 and is_integer(height) and height > 0 do
    {:ok, :pass}
  end

  defp validate_generated_dimensions(_width, _height) do
    {:error, ErrorCat.custom("generated image dimensions are invalid")}
  end

  defp validate_generated_metadata(batch_ref, candidate_owner_ref, variant_key)
       when is_binary(batch_ref) and is_binary(candidate_owner_ref) and is_binary(variant_key) do
    {:ok, :pass}
  end

  defp validate_generated_metadata(_batch_ref, _candidate_owner_ref, _variant_key) do
    {:error, ErrorCat.custom("generated image batch metadata is required")}
  end

  defp validate_completion(attrs) do
    cond do
      not is_binary(attrs.public_ref) or not String.starts_with?(attrs.public_ref, "asset_") ->
        {:error, ErrorCat.custom("asset_public_ref is invalid")}

      not is_binary(attrs.content_hash) or not String.starts_with?(attrs.content_hash, "sha256:") ->
        {:error, ErrorCat.custom("content_hash must use sha256:<hex>")}

      not is_integer(attrs.size_bytes) or attrs.size_bytes <= 0 ->
        {:error, ErrorCat.custom("size_bytes must be positive")}

      true ->
        {:ok, :pass}
    end
  end

  defp ensure_capacity(community_id, incoming_size_bytes)
       when is_integer(incoming_size_bytes) do
    case normalize_id(community_id) do
      nil ->
        {:error, ErrorCat.custom("community asset storage quota exceeded")}

      community_id ->
        used_bytes =
          community_id
          |> CommunityAsset.active_query()
          |> select([asset], coalesce(sum(asset.size_bytes), 0))
          |> Repo.one()

        if storage_bytes_to_integer(used_bytes) + incoming_size_bytes <= @storage_limit_bytes do
          {:ok, :pass}
        else
          {:error, ErrorCat.custom("community asset storage quota exceeded")}
        end
    end
  end

  defp ensure_capacity(_, _) do
    {:error, ErrorCat.custom("community asset storage quota exceeded")}
  end

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

  defp generated_object_key(community_slug, batch_ref, asset_uid) do
    "communities/#{community_slug}/wallpaper-generated/#{batch_ref}/#{asset_uid}/original"
  end

  defp pad2(value) when is_integer(value) do
    value |> Integer.to_string() |> String.pad_leading(2, "0")
  end

  defp asset_type_from_mime("image/" <> _), do: :image
  defp asset_type_from_mime(_), do: :file

  defp valid_thread?(thread), do: match?({:ok, _}, ThreadIdentity.to_atom(thread))

  defp normalize_thread(thread) do
    {:ok, thread} = ThreadIdentity.to_atom(thread)
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
