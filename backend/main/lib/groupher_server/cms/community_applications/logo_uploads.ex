defmodule GroupherServer.CMS.CommunityApplications.LogoUploads do
  @moduledoc "Application-scoped Logo upload intent, completion, and ownership checks."

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Assets.Capability
  alias GroupherServer.CMS.CommunityApplications.{Config, Policy}
  alias GroupherServer.CMS.Model.CommunityApplicationLogoUpload
  alias GroupherServer.Repo
  alias Helper.Utils

  @allowed_mime_types ~w(image/jpeg image/png image/webp image/gif)
  @max_size_bytes 10 * 1024 * 1024

  @spec create_intent(map(), User.t()) :: {:ok, map()} | {:error, term()}
  def create_intent(file, %User{} = user) when is_map(file) do
    with %{allowed: true} <- Policy.can_apply(user),
         {:ok, attrs} <- validate_file(file) do
      now = DateTime.utc_now(:second)
      upload_ref = "app_logo_" <> Utils.uid(24)
      object_key = "community-applications/#{user.id}/#{upload_ref}/original"
      canonical_url = "#{Capability.public_endpoint()}/a/#{upload_ref}/original"
      expires_at = DateTime.add(now, Config.logo_upload_ttl_seconds(), :second)

      changeset =
        CommunityApplicationLogoUpload.changeset(%CommunityApplicationLogoUpload{}, %{
          public_ref: upload_ref,
          user_id: user.id,
          filename: attrs.filename,
          mime_type: attrs.mime_type,
          size_bytes: attrs.size_bytes,
          status: :pending,
          expires_at: expires_at
        })

      with {:ok, _upload} <- Repo.insert(changeset) do
        payload = %{
          "purpose" => "community_application_logo",
          "uploadRef" => upload_ref,
          "uploaderId" => user.id,
          "objectKey" => object_key,
          "canonicalUrl" => canonical_url,
          "declaredFilename" => attrs.filename,
          "declaredMimeType" => attrs.mime_type,
          "declaredSizeBytes" => attrs.size_bytes,
          "allowedMimeTypes" => @allowed_mime_types,
          "maxSizeBytes" => @max_size_bytes,
          "expiresAt" => DateTime.to_iso8601(expires_at)
        }

        {:ok,
         %{
           upload_ref: upload_ref,
           object_key: object_key,
           canonical_url: canonical_url,
           capability: Capability.sign(payload),
           expires_at: expires_at,
           max_size_bytes: @max_size_bytes,
           allowed_mime_types: @allowed_mime_types
         }}
      end
    else
      %{allowed: false, reason_code: reason_code} -> {:error, reason_code}
      error -> error
    end
  end

  @spec complete(map()) :: {:ok, CommunityApplicationLogoUpload.t()} | {:error, term()}
  def complete(input) when is_map(input) do
    upload_ref = get(input, :upload_ref)
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      upload =
        CommunityApplicationLogoUpload
        |> where([upload], upload.public_ref == ^upload_ref)
        |> lock("FOR UPDATE")
        |> Repo.one()

      cond do
        is_nil(upload) ->
          Repo.rollback(:asset_not_found)

        upload.status in [:finalized, :promoted] ->
          upload

        upload.status != :pending or DateTime.compare(upload.expires_at, now) != :gt ->
          Repo.rollback(:asset_not_ready)

        true ->
          attrs = %{
            storage: get(input, :storage),
            storage_key: get(input, :storage_key),
            url: get(input, :url),
            content_hash: get(input, :content_hash),
            mime_type: get(input, :mime_type),
            size_bytes: get(input, :size_bytes),
            status: :finalized,
            finalized_at: now
          }

          with :ok <- validate_completion(upload, attrs),
               {:ok, finalized} <-
                 upload |> CommunityApplicationLogoUpload.changeset(attrs) |> Repo.update() do
            finalized
          else
            {:error, reason} -> Repo.rollback(reason)
          end
      end
    end)
  end

  @spec fetch_finalized(String.t(), User.t()) ::
          {:ok, CommunityApplicationLogoUpload.t()} | {:error, atom()}
  def fetch_finalized(public_ref, %User{id: user_id}) when is_binary(public_ref) do
    case Repo.get_by(CommunityApplicationLogoUpload, public_ref: public_ref) do
      nil ->
        {:error, :asset_not_found}

      %{user_id: owner_id} when owner_id != user_id ->
        {:error, :asset_not_owned}

      %{status: status} when status != :finalized ->
        {:error, :asset_not_ready}

      %{application_id: application_id} when not is_nil(application_id) ->
        {:error, :asset_not_ready}

      upload ->
        {:ok, upload}
    end
  end

  @spec attach(Multi.t(), atom(), CommunityApplicationLogoUpload.t(), atom()) :: Multi.t()
  def attach(multi, name, %CommunityApplicationLogoUpload{} = upload, application_key) do
    Multi.update(multi, name, fn changes ->
      application = Map.fetch!(changes, application_key)
      CommunityApplicationLogoUpload.changeset(upload, %{application_id: application.id})
    end)
  end

  @spec expire_due(DateTime.t()) :: {non_neg_integer(), nil}
  def expire_due(%DateTime{} = now) do
    uploads =
      from(upload in CommunityApplicationLogoUpload,
        where:
          upload.status in [:pending, :finalized] and upload.expires_at <= ^now and
            is_nil(upload.application_id),
        limit: 100
      )
      |> Repo.all()

    ids = Enum.map(uploads, & &1.id)

    result =
      from(upload in CommunityApplicationLogoUpload, where: upload.id in ^ids)
      |> Repo.update_all(set: [status: :expired, updated_at: now])

    Enum.each(uploads, &CMS.Assets.delete_application_upload_object/1)
    result
  end

  defp validate_file(file) do
    filename = file |> get(:file_name) |> normalize_string()
    mime_type = file |> get(:mime_type) |> normalize_string()
    size_bytes = get(file, :size_bytes)

    cond do
      is_nil(filename) ->
        {:error, :asset_not_ready}

      mime_type not in @allowed_mime_types ->
        {:error, :asset_not_ready}

      not is_integer(size_bytes) or size_bytes <= 0 or size_bytes > @max_size_bytes ->
        {:error, :asset_not_ready}

      true ->
        {:ok, %{filename: filename, mime_type: mime_type, size_bytes: size_bytes}}
    end
  end

  defp validate_completion(upload, attrs) do
    cond do
      not is_binary(attrs.storage) or not is_binary(attrs.storage_key) or not is_binary(attrs.url) ->
        {:error, :asset_not_ready}

      not is_binary(attrs.content_hash) or not String.starts_with?(attrs.content_hash, "sha256:") ->
        {:error, :asset_not_ready}

      attrs.mime_type != upload.mime_type or attrs.size_bytes != upload.size_bytes ->
        {:error, :asset_not_ready}

      true ->
        :ok
    end
  end

  defp get(map, key), do: Map.get(map, key) || Map.get(map, Atom.to_string(key))

  defp normalize_string(value) when is_binary(value) do
    value = String.trim(value)
    if value == "", do: nil, else: value
  end

  defp normalize_string(_), do: nil
end
