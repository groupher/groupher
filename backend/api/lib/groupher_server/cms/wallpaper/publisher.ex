defmodule GroupherServer.CMS.Wallpaper.Publisher do
  @moduledoc """
  Publishes or restores immutable Wallpaper Snapshots and the active pointer.

  Assets Hub capability verification happens before the bounded database
  transaction. Snapshot, images, receipt, and active pointer commit together.

  Business position:

      CMS.Wallpaper facade
        -> Wallpaper.Publisher
        -> Assets Hub claim
        -> Repo transaction
        -> Wallpaper.Retention
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Helper.Utils
  alias Accounts.Model.User
  alias CMS.Assets.GeneratedBatch
  alias CMS.Assets.GeneratedBatch.PublishCapability

  alias CMS.Model.{
    Community,
    CommunityWallpaper,
    WallpaperPublishReceipt,
    WallpaperSnapshot,
    WallpaperSnapshotImage
  }

  alias CMS.Wallpaper.{
    ErrorCat,
    Query,
    RequestDigest,
    Retention,
    Settings,
    Upload
  }

  @request_digest_version RequestDigest.active_version()
  @profile_version 1
  @database_transaction_timeout_ms 5_000
  @database_lock_timeout_ms 4_000
  @publish_transaction_budget_ms 10_000
  @max_clock_skew_ms 5_000
  @batch_ttl_seconds 15 * 60
  @publish_policy_version "v1"
  @publish_signing_key_id "hmac-v1"

  defp batch_client do
    Application.get_env(:groupher_server, :wallpaper_batch_client, GeneratedBatch)
  end

  @doc "Publishes one current-theme Snapshot, or a canonical NONE Snapshot."
  def publish(%Community{} = community, input, %User{} = user) when is_map(input) do
    assert_lease_policy!()

    theme = get(input, :theme)
    base_version = get(input, :base_version)
    command_id = get(input, :command_id)
    batch_ref = get(input, :batch_ref)

    with {:ok, _} <- validate_theme(theme),
         {:ok, settings} <- Settings.normalize(get(input, :settings)),
         {:ok, _} <- validate_publish_metadata(base_version, command_id),
         {:ok, _} <- validate_batch_requirement(settings, batch_ref) do
      digest = Upload.request_digest(community.id, theme, base_version, settings)

      case existing_publish_receipt(community.id, command_id, digest) do
        {:ok, response} ->
          {:ok, response}

        {:error, reason} ->
          {:error, reason}

        :miss ->
          publish_once(
            community,
            user,
            theme,
            settings,
            base_version,
            command_id,
            batch_ref,
            digest
          )
      end
    end
  end

  @doc "Restores one retained public Snapshot ID for its original theme."
  def restore_snapshot(%Community{} = community, input, %User{}) when is_map(input) do
    snapshot_id = get(input, :snapshot_id)
    base_version = get(input, :base_version)

    Repo.transaction(fn ->
      state = lock_or_create_wallpaper(community.id)

      if state.version != base_version do
        Repo.rollback(ErrorCat.wallpaper_publish_version_conflict())
      end

      snapshot =
        Repo.one(
          from(snapshot in WallpaperSnapshot,
            where:
              snapshot.community_id == ^community.id and snapshot.public_ref == ^snapshot_id and
                is_nil(snapshot.delete_after),
            lock: "FOR UPDATE"
          )
        )

      if is_nil(snapshot), do: Repo.rollback(ErrorCat.wallpaper_snapshot_not_restorable())

      unless Query.supported_snapshot?(snapshot) do
        Repo.rollback(ErrorCat.wallpaper_snapshot_not_restorable())
      end

      if snapshot.settings["type"] != "none" and
           not Query.complete_profile_manifest?(Query.snapshot_images(snapshot.public_ref)) do
        Repo.rollback(ErrorCat.wallpaper_snapshot_not_restorable())
      end

      now = DateTime.utc_now(:second)

      {:ok, state} =
        state
        |> CommunityWallpaper.changeset(%{
          active_field(snapshot.theme) => snapshot.public_ref,
          version: state.version + 1
        })
        |> Repo.update()

      snapshot
      |> WallpaperSnapshot.changeset(%{activated_at: now, history_used_at: now})
      |> Repo.update!()

      Retention.retain_latest_snapshots(community.id, state, now)
      %{version: state.version}
    end)
  end

  defp publish_once(
         community,
         user,
         theme,
         settings,
         base_version,
         command_id,
         batch_ref,
         digest
       ) do
    with {:ok, capability} <-
           prepare_publish_capability(
             community,
             theme,
             batch_ref,
             command_id,
             digest,
             settings
           ),
         {:ok, _} <- ensure_publish_lease(capability) do
      case run_publish_transaction(fn ->
             configure_publish_transaction!()
             ensure_publish_lease!(capability)

             publish_transaction(
               community,
               user,
               theme,
               settings,
               base_version,
               command_id,
               batch_ref,
               capability,
               digest
             )
           end) do
        {:ok, response} ->
          {:ok, response}

        {:error, reason} ->
          cleanup_publish_capability(community, batch_ref, capability)
          {:error, reason}
      end
    end
  end

  defp publish_transaction(
         community,
         user,
         theme,
         settings,
         base_version,
         command_id,
         batch_ref,
         capability,
         digest
       ) do
    case Repo.get_by(WallpaperPublishReceipt,
           community_id: community.id,
           command_id: command_id
         ) do
      %WallpaperPublishReceipt{
        request_digest: ^digest,
        request_digest_version: @request_digest_version
      } = receipt ->
        recovered_receipt_response(community.id, receipt.response_payload)

      %WallpaperPublishReceipt{} ->
        Repo.rollback(ErrorCat.wallpaper_publish_command_conflict())

      nil ->
        state = lock_or_create_wallpaper(community.id)

        if state.version != base_version do
          Repo.rollback(ErrorCat.wallpaper_publish_version_conflict())
        end

        now = DateTime.utc_now(:second)
        snapshot_ref = (capability && capability.snapshot_ref) || new_snapshot_ref!()

        {:ok, _} = Settings.assert_current_version!(settings)

        image_rows =
          capability && snapshot_images_from_manifest(capability.manifest, snapshot_ref)

        attrs = %{
          activated_at: now,
          community_id: community.id,
          created_by_id: to_string(user.id),
          history_used_at: now,
          profile_version: @profile_version,
          public_ref: snapshot_ref,
          settings: settings,
          settings_schema_version: settings["settingsSchemaVersion"],
          source_batch_ref: batch_ref,
          theme: theme
        }

        {:ok, _snapshot} =
          %WallpaperSnapshot{} |> WallpaperSnapshot.changeset(attrs) |> Repo.insert()

        Enum.each(image_rows || [], fn row ->
          {:ok, _image} =
            %WallpaperSnapshotImage{} |> WallpaperSnapshotImage.changeset(row) |> Repo.insert()
        end)

        {:ok, state} =
          state
          |> CommunityWallpaper.changeset(%{
            active_field(theme) => snapshot_ref,
            version: state.version + 1
          })
          |> Repo.update()

        Retention.retain_latest_snapshots(community.id, state, now)

        response = %{version: state.version}

        receipt_attrs = %{
          community_id: community.id,
          expires_at: DateTime.add(now, Retention.publish_receipt_retention_seconds(), :second),
          command_id: command_id,
          request_digest: digest,
          request_digest_version: @request_digest_version,
          response_payload: %{"version" => state.version}
        }

        {:ok, _receipt} =
          %WallpaperPublishReceipt{}
          |> WallpaperPublishReceipt.changeset(receipt_attrs)
          |> Repo.insert()

        response
    end
  end

  defp prepare_publish_capability(community, theme, batch_ref, command_id, digest, settings) do
    if settings["type"] == "none" do
      {:ok, nil}
    else
      case batch_client().claim_for_publish(batch_ref, command_id) do
        {:ok, result} ->
          with {:ok, capability} <- verify_publish_capability(result, batch_ref, digest),
               {:ok, snapshot_ref} <- validate_publish_manifest(capability.manifest, theme) do
            {:ok, Map.put(capability, :snapshot_ref, snapshot_ref)}
          else
            {:error, _reason} = error ->
              cleanup_publish_claim(community, batch_ref, result)
              error
          end

        error ->
          error
      end
    end
  end

  defp verify_publish_capability(result, batch_ref, digest) when is_map(result) do
    token = get(result, :capability)

    with true <- is_binary(token),
         {:ok, payload} <- PublishCapability.verify(token),
         true <- payload.batch_ref == batch_ref,
         true <- payload.request_digest == digest,
         true <- payload.request_digest_version == @request_digest_version,
         true <- payload.policy_version == @publish_policy_version,
         true <- payload.signing_key_id == @publish_signing_key_id,
         true <- payload.manifest_digest == PublishCapability.manifest_digest(payload.manifest) do
      {:ok, %{expires_at: payload.expires_at, manifest: payload.manifest, token: token}}
    else
      _ -> {:error, ErrorCat.wallpaper_publish_capability_invalid()}
    end
  end

  defp verify_publish_capability(_result, _batch_ref, _digest) do
    {:error, ErrorCat.wallpaper_publish_capability_invalid()}
  end

  defp validate_publish_manifest(manifest, theme) when is_list(manifest) do
    owners = manifest |> Enum.map(&get(&1, :candidate_owner_ref)) |> Enum.uniq()

    with [snapshot_ref] <- owners,
         targets = Upload.required_image_targets(theme, snapshot_ref),
         true <- length(manifest) == length(targets),
         true <- Enum.all?(targets, fn target -> valid_manifest_target?(manifest, target) end) do
      {:ok, snapshot_ref}
    else
      _ -> {:error, ErrorCat.wallpaper_publish_manifest_invalid()}
    end
  end

  defp valid_manifest_target?(manifest, target) do
    case Enum.find(manifest, &(get(&1, :variant_key) == target.type)) do
      nil ->
        false

      entry ->
        get(entry, :candidate_owner_ref) == target.snapshot_ref and
          get(entry, :width) == target.width and get(entry, :height) == target.height and
          get(entry, :mime_type) == target.mime_type and
          valid_asset_ref?(get(entry, :asset_public_ref)) and
          valid_string?(get(entry, :checksum)) and valid_string?(get(entry, :storage_key))
    end
  end

  defp snapshot_images_from_manifest(manifest, snapshot_ref) do
    Enum.map(manifest, fn entry ->
      profile = profile_from_target(get(entry, :variant_key))
      if is_nil(profile), do: Repo.rollback(ErrorCat.wallpaper_publish_manifest_invalid())

      %{
        asset_public_ref: get(entry, :asset_public_ref),
        checksum: get(entry, :checksum),
        format: :webp,
        height: get(entry, :height),
        profile: profile,
        wallpaper_snapshot_ref: snapshot_ref,
        width: get(entry, :width)
      }
    end)
  end

  defp profile_from_target(variant_key) when is_binary(variant_key) do
    Enum.find_value(Upload.profiles(), fn profile ->
      variant_key in ["light-#{profile}", "dark-#{profile}"] && profile
    end)
  end

  defp profile_from_target(_variant_key), do: nil

  defp lock_or_create_wallpaper(community_id) do
    query =
      from(state in CommunityWallpaper,
        where: state.community_id == ^community_id,
        lock: "FOR UPDATE"
      )

    case Repo.one(query) do
      %CommunityWallpaper{} = state ->
        state

      nil ->
        %CommunityWallpaper{}
        |> CommunityWallpaper.changeset(%{
          community_id: community_id,
          public_ref: "ww_" <> Utils.uid(24),
          version: 0
        })
        |> Repo.insert(on_conflict: :nothing, conflict_target: [:community_id])

        Repo.one!(query)
    end
  end

  defp validate_publish_metadata(version, key) do
    cond do
      not is_integer(version) or version < 0 ->
        {:error, ErrorCat.wallpaper_publish_base_version_invalid()}

      not is_binary(key) or String.trim(key) == "" ->
        {:error, ErrorCat.wallpaper_publish_command_id_invalid()}

      true ->
        {:ok, :pass}
    end
  end

  defp validate_batch_requirement(%{"type" => "none"}, nil), do: {:ok, :pass}

  defp validate_batch_requirement(%{"type" => "none"}, _) do
    {:error, ErrorCat.wallpaper_none_publish_must_not_have_batch()}
  end

  defp validate_batch_requirement(_settings, batch_ref)
       when is_binary(batch_ref) and batch_ref != "" do
    {:ok, :pass}
  end

  defp validate_batch_requirement(_settings, _) do
    {:error, ErrorCat.wallpaper_upload_batch_required()}
  end

  defp validate_theme(theme) when theme in [:light, :dark], do: {:ok, :pass}
  defp validate_theme(_), do: {:error, ErrorCat.wallpaper_settings_invalid()}

  defp active_field(:light), do: :active_light_snapshot_ref
  defp active_field(:dark), do: :active_dark_snapshot_ref

  defp new_snapshot_ref!, do: "wsnap_" <> Utils.uid(24)

  defp existing_publish_receipt(community_id, key, digest) do
    case Repo.get_by(WallpaperPublishReceipt, community_id: community_id, command_id: key) do
      %WallpaperPublishReceipt{
        request_digest: ^digest,
        request_digest_version: @request_digest_version
      } = receipt ->
        {:ok, recovered_receipt_response(community_id, receipt.response_payload)}

      %WallpaperPublishReceipt{} ->
        {:error, ErrorCat.wallpaper_publish_command_conflict()}

      nil ->
        :miss
    end
  end

  defp result_from_payload(%{"version" => version}), do: %{version: version}
  defp result_from_payload(%{version: version}), do: %{version: version}

  defp recovered_receipt_response(community_id, payload) do
    current = Repo.get_by(CommunityWallpaper, community_id: community_id)
    Map.put(result_from_payload(payload), :version, Query.state_version(current))
  end

  defp assert_lease_policy! do
    true = @database_lock_timeout_ms < @database_transaction_timeout_ms
    true = @database_transaction_timeout_ms < @publish_transaction_budget_ms
    true = @publish_transaction_budget_ms + @max_clock_skew_ms < @batch_ttl_seconds * 1_000
    {:ok, :pass}
  end

  defp ensure_publish_lease(nil), do: {:ok, :pass}

  defp ensure_publish_lease(%{expires_at: expires_at}) do
    required_ms = @publish_transaction_budget_ms + @max_clock_skew_ms

    if DateTime.diff(expires_at, DateTime.utc_now(), :millisecond) > required_ms do
      {:ok, :pass}
    else
      {:error, ErrorCat.wallpaper_publish_lease_too_short()}
    end
  end

  defp ensure_publish_lease!(capability) do
    case ensure_publish_lease(capability) do
      {:ok, _} -> {:ok, :pass}
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp configure_publish_transaction! do
    Repo.query!("SELECT set_config('statement_timeout', $1, true)", [
      "#{@database_transaction_timeout_ms}ms"
    ])

    Repo.query!("SELECT set_config('lock_timeout', $1, true)", ["#{@database_lock_timeout_ms}ms"])
  end

  defp run_publish_transaction(callback) do
    Repo.transaction(callback, timeout: @database_transaction_timeout_ms)
  rescue
    DBConnection.ConnectionError -> {:error, ErrorCat.wallpaper_publish_transaction_timeout()}
  end

  defp cleanup_publish_claim(_community, batch_ref, result)
       when is_binary(batch_ref) and is_map(result) do
    case get(result, :capability) do
      token when is_binary(token) -> cleanup_batch_claim(batch_ref, token)
      _ -> {:ok, :pass}
    end

    {:ok, :pass}
  end

  defp cleanup_publish_claim(_community, _batch_ref, _result), do: {:ok, :pass}

  defp cleanup_publish_capability(_community, batch_ref, capability)
       when is_binary(batch_ref) and is_map(capability) do
    case get(capability, :token) do
      token when is_binary(token) -> cleanup_batch_claim(batch_ref, token)
      _ -> {:ok, :pass}
    end

    {:ok, :pass}
  end

  defp cleanup_publish_capability(_community, _batch_ref, _capability), do: {:ok, :pass}

  defp cleanup_batch_claim(batch_ref, token) do
    case published_batch_status(batch_ref) do
      :published -> {:ok, :pass}
      :not_published -> _ = batch_client().delete_claim(batch_ref, token)
      :unknown -> {:ok, :pass}
    end
  end

  defp published_batch_status(batch_ref) do
    if Query.batch_published?(batch_ref), do: :published, else: :not_published
  rescue
    _ -> :unknown
  end

  defp valid_string?(value), do: is_binary(value) and value != ""
  defp valid_asset_ref?(value), do: valid_string?(value)

  defp get(map, key) when is_map(map) and is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp get(_map, _key), do: nil
end
