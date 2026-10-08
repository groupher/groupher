defmodule GroupherServer.CMS.Wallpaper.Upload do
  @moduledoc """
  Validates Wallpaper render inputs and creates temporary Assets Hub upload capabilities.

  Business position:

      CMS.Wallpaper facade
        -> Wallpaper.Upload
        -> Assets generated upload intents
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Helper.Utils
  alias Accounts.Model.User
  alias CMS.Assets.Capability
  alias CMS.Model.{Community, CommunityWallpaper}
  alias CMS.Wallpaper.{ErrorCat, Query, RequestDigest, Settings}

  @request_digest_version RequestDigest.active_version()
  @batch_ttl_seconds 15 * 60
  @profiles [:wide, :desktop, :tablet, :phone]
  @profile_specs [
    %{key: :wide, logical_width: 1920, logical_height: 1080, width: 1920, height: 1080},
    %{key: :desktop, logical_width: 1440, logical_height: 900, width: 1440, height: 900},
    %{key: :tablet, logical_width: 1024, logical_height: 1366, width: 1024, height: 1366},
    %{key: :phone, logical_width: 390, logical_height: 844, width: 390, height: 844}
  ]

  @doc "Returns the cross-language Wallpaper profile matrix."
  def profile_specs, do: @profile_specs

  @doc "Returns the ordered Wallpaper profile keys."
  def profiles, do: @profiles

  @doc "Returns the Assets Hub targets for one theme and one internal Snapshot ref."
  def required_image_targets(theme, snapshot_ref)
      when theme in [:light, :dark] and is_binary(snapshot_ref) do
    Enum.map(@profile_specs, fn profile ->
      %{
        height: profile.height,
        mime_type: "image/webp",
        profile: profile.key,
        snapshot_ref: snapshot_ref,
        type: "#{theme}-#{profile.key}",
        width: profile.width
      }
    end)
  end

  @doc "Creates the temporary Assets Hub Batch for the current theme only."
  def prepare(%Community{} = community, input, %User{} = user) when is_map(input) do
    theme = get(input, :theme)
    settings_input = get(input, :settings)
    images = get(input, :images)
    base_version = get(input, :base_version)
    idempotency_key = get(input, :idempotency_key)

    with {:ok, _} <- validate_theme(theme),
         {:ok, settings} <- Settings.normalize(settings_input),
         {:ok, _} <- validate_publish_metadata(base_version, idempotency_key),
         {:ok, _} <- ensure_current_version(community.id, base_version),
         {:ok, _} <- ensure_renderable(settings),
         {:ok, snapshot_ref} <- new_snapshot_ref(),
         {:ok, targets} <- validate_image_input(theme, snapshot_ref, images) do
      issued_at = DateTime.utc_now(:second)
      batch_ref = "wbatch_" <> Utils.uid(24)
      expires_at = DateTime.add(issued_at, @batch_ttl_seconds, :second)

      batch_payload = %{
        "capabilityPurpose" => "generated_image_batch",
        "batchRef" => batch_ref,
        "expectedVariants" => Enum.map(targets, &batch_target_wire/1),
        "expiresAt" => DateTime.to_iso8601(expires_at),
        "purpose" => "wallpaper-render",
        "requestDigest" => request_digest(community.id, theme, base_version, settings),
        "requestDigestVersion" => @request_digest_version
      }

      with {:ok, upload_intents} <-
             build_upload_intents(community, user, batch_ref, targets, images) do
        {:ok,
         %{
           batch_capability: Capability.sign(batch_payload),
           batch_ref: batch_ref,
           expires_at: expires_at,
           upload_intents: upload_intents
         }}
      end
    end
  end

  @doc "Builds the canonical request digest shared by upload and publish."
  def request_digest(community_id, theme, base_version, settings) do
    RequestDigest.digest(%{
      base_version: base_version,
      community_id: community_id,
      request_digest_version: @request_digest_version,
      settings: settings,
      theme: theme
    })
  end

  defp ensure_current_version(community_id, version) do
    state = Repo.get_by(CommunityWallpaper, community_id: community_id)

    if Query.state_version(state) == version do
      {:ok, :pass}
    else
      {:error, ErrorCat.wallpaper_publish_version_conflict()}
    end
  end

  defp validate_publish_metadata(version, key) do
    cond do
      not is_integer(version) or version < 0 ->
        {:error, ErrorCat.wallpaper_publish_base_version_invalid()}

      not is_binary(key) or String.trim(key) == "" ->
        {:error, ErrorCat.wallpaper_publish_idempotency_key_invalid()}

      true ->
        {:ok, :pass}
    end
  end

  defp ensure_renderable(%{"type" => "none"}) do
    {:error, ErrorCat.wallpaper_upload_images_invalid()}
  end

  defp ensure_renderable(_), do: {:ok, :pass}

  defp validate_theme(theme) when theme in [:light, :dark], do: {:ok, :pass}
  defp validate_theme(_), do: {:error, ErrorCat.wallpaper_settings_invalid()}

  defp validate_image_input(theme, snapshot_ref, images) when is_list(images) do
    targets = required_image_targets(theme, snapshot_ref)

    if length(images) != length(targets) do
      {:error,
       ErrorCat.wallpaper_upload_images_invalid(%{
         actual: length(images),
         expected: length(targets),
         message:
           "Wallpaper images count invalid: expected #{length(targets)}, got #{length(images)}"
       })}
    else
      image_by_profile =
        Map.new(images, fn image -> {normalize_profile(get(image, :profile)), image} end)

      Enum.reduce_while(targets, {:ok, targets}, fn target, acc ->
        image = Map.get(image_by_profile, target.profile)

        case validate_image(image, target) do
          {:ok, _} -> {:cont, acc}
          {:error, details} -> {:halt, {:error, ErrorCat.wallpaper_upload_image_invalid(details)}}
        end
      end)
    end
  end

  defp validate_image(image, target) when is_map(image) do
    checks = [
      {:width, target.width, get(image, :width)},
      {:height, target.height, get(image, :height)},
      {:mime_type, target.mime_type, get(image, :mime_type)}
    ]

    case Enum.find(checks, fn {_field, expected, actual} -> expected != actual end) do
      {field, expected, actual} ->
        {:error, image_error_details(target.profile, field, expected, actual)}

      nil ->
        if is_integer(get(image, :size_bytes)) and get(image, :size_bytes) > 0 and
             valid_string?(get(image, :checksum)) do
          {:ok, :pass}
        else
          {:error, image_error_details(target.profile, :metadata, :valid, image)}
        end
    end
  end

  defp validate_image(_image, target) do
    {:error, image_error_details(target.profile, :entry, :map, nil)}
  end

  defp image_error_details(profile, field, expected, actual) do
    %{
      actual: actual,
      expected: expected,
      field: field,
      message:
        "Wallpaper image #{profile} has invalid #{field}: expected #{format_detail(expected)}, got #{format_detail(actual)}",
      profile: profile
    }
  end

  defp format_detail(value) when is_binary(value), do: value
  defp format_detail(value), do: inspect(value)

  defp build_upload_intents(community, user, batch_ref, targets, images) do
    image_by_profile =
      Map.new(images, fn image -> {normalize_profile(get(image, :profile)), image} end)

    Enum.reduce_while(targets, {:ok, []}, fn target, {:ok, intents} ->
      image = Map.fetch!(image_by_profile, target.profile)

      file = %{
        batch_ref: batch_ref,
        candidate_owner_ref: target.snapshot_ref,
        checksum_sha256: get(image, :checksum),
        filename: "#{target.type}.webp",
        height: target.height,
        mime_type: target.mime_type,
        size_bytes: get(image, :size_bytes),
        variant_key: target.type,
        width: target.width
      }

      case GroupherServer.CMS.Assets.create_generated_upload_intent(community, file, user) do
        {:ok, intent} -> {:cont, {:ok, [Map.put(intent, :profile, target.profile) | intents]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, intents} -> {:ok, Enum.reverse(intents)}
      error -> error
    end
  end

  defp batch_target_wire(target) do
    %{
      "candidateOwnerRef" => target.snapshot_ref,
      "height" => target.height,
      "mimeType" => target.mime_type,
      "variantKey" => target.type,
      "width" => target.width
    }
  end

  defp normalize_profile(profile) when profile in @profiles, do: profile

  defp normalize_profile(profile) when is_binary(profile) do
    Enum.find(@profiles, &(Atom.to_string(&1) == profile))
  end

  defp normalize_profile(_), do: nil

  defp new_snapshot_ref, do: {:ok, "wsnap_" <> Utils.uid(24)}
  defp valid_string?(value), do: is_binary(value) and value != ""

  defp get(map, key) when is_map(map) and is_atom(key) do
    Map.get(map, key) || Map.get(map, Atom.to_string(key))
  end

  defp get(_map, _key), do: nil
end
