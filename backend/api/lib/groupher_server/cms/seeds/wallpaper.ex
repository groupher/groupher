defmodule GroupherServer.CMS.Seeds.Wallpaper do
  @moduledoc """
  Publishes versioned Wallpaper fixtures for one Community without a browser.

  The seed owns fixture validation and server-side upload orchestration. Asset
  registration and Snapshot publication remain behind the existing Assets Hub
  and CMS.Wallpaper boundaries.

      LiteHome -> Seeds.Wallpaper -> Wallpaper.Upload
        -> Assets Hub upload intent / R2 / finalize
        -> Wallpaper.publish -> active Snapshot
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Community, CommunityAsset, CommunityWallpaper, WallpaperSnapshot}
  alias CMS.Model.WallpaperSnapshotImage
  alias CMS.Seeds.Helper
  alias CMS.Wallpaper

  @fixture_version "default-v1"
  @fixture_manifest_path Path.expand(
                           "../../../../../../packages/contracts/fixtures/wallpaper/default-v1/manifest.json",
                           __DIR__
                         )
  @themes [:light, :dark]

  @doc "Publishes the versioned Wallpaper fixture for both themes of one Community."
  @spec seed(Community.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def seed(%Community{} = community, opts \\ []) when is_list(opts) do
    with {:ok, fixture} <- load_fixture(Keyword.get(opts, :manifest_path, @fixture_manifest_path)),
         {:ok, _light} <- seed_theme(community, :light, fixture, opts),
         {:ok, _dark} <- seed_theme(community, :dark, fixture, opts) do
      {:ok, :pass}
    end
  end

  defp seed_theme(community, theme, fixture, opts) do
    case active_theme_matches?(community, theme, fixture, opts) do
      {:ok, true} -> {:ok, :skipped}
      {:ok, false} -> publish_theme(community, theme, fixture, opts)
      {:error, _reason} = error -> error
    end
  end

  defp publish_theme(community, theme, fixture, opts) do
    with {:ok, actor} <- Helper.seed_bot(),
         {:ok, prepared} <- prepare_upload(community, theme, fixture, actor),
         {:ok, :pass} <- asset_hub(opts).create_batch(prepared.batch_capability) do
      case upload_and_publish(community, theme, fixture, actor, prepared, opts) do
        {:ok, result} ->
          case active_theme_matches?(community, theme, fixture, opts) do
            {:ok, true} -> {:ok, result}
            {:ok, false} -> {:error, {:wallpaper_seed_incomplete, theme}}
            {:error, _reason} = error -> error
          end

        {:error, _reason} = error ->
          _ = asset_hub(opts).cancel_batch(prepared.batch_ref, prepared.batch_capability)
          error
      end
    end
  end

  defp prepare_upload(community, theme, fixture, actor) do
    images =
      fixture.entries
      |> Enum.filter(&(&1.theme == theme))
      |> Enum.map(&upload_image_input/1)

    base_version = Wallpaper.wallpaper(community.id).version

    input = %{
      base_version: base_version,
      command_id: seed_command_id(community.id, theme, fixture.version, base_version, :prepare),
      images: images,
      settings: Map.fetch!(Wallpaper.wallpaper_settings(community.id), theme),
      theme: theme
    }

    Wallpaper.prepare_upload(community, input, actor)
  end

  defp upload_and_publish(community, theme, fixture, actor, prepared, opts) do
    entries = Enum.filter(fixture.entries, &(&1.theme == theme))
    intent_by_profile = Map.new(prepared.upload_intents, &{&1.profile, &1})

    case upload_entries(entries, intent_by_profile, asset_hub(opts)) do
      {:ok, asset_refs} ->
        base_version = Wallpaper.wallpaper(community.id).version

        case Wallpaper.publish(
               community,
               %{
                 base_version: base_version,
                 batch_ref: prepared.batch_ref,
                 command_id:
                   seed_command_id(community.id, theme, fixture.version, base_version, :publish),
                 fixture_version: fixture.version,
                 settings: Map.fetch!(Wallpaper.wallpaper_settings(community.id), theme),
                 theme: theme
               },
               actor
             ) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> cleanup_uploaded_assets(community, asset_refs, reason)
        end

      {:error, reason, asset_refs} ->
        cleanup_uploaded_assets(community, asset_refs, reason)
    end
  end

  defp upload_entries(entries, intent_by_profile, client) do
    Enum.reduce_while(entries, {:ok, []}, fn entry, {:ok, asset_refs} ->
      case Map.fetch(intent_by_profile, entry.profile) do
        {:ok, intent} ->
          case client.upload(intent.capability, intent.upload_ref, entry.bytes) do
            {:ok, result} ->
              {:cont, {:ok, [asset_public_ref(result) | asset_refs]}}

            {:error, reason} ->
              {:halt, {:error, reason, asset_refs}}
          end

        :error ->
          {:halt, {:error, {:wallpaper_upload_intent_missing, entry.profile}, asset_refs}}
      end
    end)
    |> case do
      {:ok, asset_refs} -> {:ok, Enum.reject(asset_refs, &is_nil/1)}
      error -> error
    end
  end

  defp cleanup_uploaded_assets(_community, [], reason), do: {:error, reason}

  defp cleanup_uploaded_assets(community, asset_refs, reason) do
    _ = CMS.Assets.delete_generated_assets(community, asset_refs)
    {:error, reason}
  end

  defp asset_public_ref(%{"asset" => %{"publicRef" => public_ref}}), do: public_ref
  defp asset_public_ref(%{asset: %{public_ref: public_ref}}), do: public_ref
  defp asset_public_ref(_result), do: nil

  defp active_theme_matches?(%Community{id: community_id}, theme, fixture, opts) do
    state = Repo.get_by(CommunityWallpaper, community_id: community_id)
    snapshot_ref = state && Map.get(state, active_field(theme))

    with ref when is_binary(ref) <- snapshot_ref,
         %WallpaperSnapshot{fixture_version: fixture_version, theme: ^theme} = _snapshot
         when fixture_version == fixture.version <-
           Repo.get_by(WallpaperSnapshot, public_ref: ref, community_id: community_id),
         images when length(images) == 4 <- snapshot_images(ref),
         {:ok, true} <- snapshot_matches_fixture?(images, fixture, community_id, theme, opts) do
      {:ok, true}
    else
      {:error, _reason} = error -> error
      _ -> {:ok, false}
    end
  end

  defp snapshot_images(snapshot_ref) do
    Repo.all(
      from(image in WallpaperSnapshotImage,
        where: image.wallpaper_snapshot_ref == ^snapshot_ref
      )
    )
  end

  defp snapshot_matches_fixture?(images, fixture, community_id, theme, opts) do
    image_by_profile = Map.new(images, &{&1.profile, &1})
    refs = Enum.map(images, & &1.asset_public_ref)

    assets = Repo.all(active_assets_query(community_id, refs))

    asset_by_ref = Map.new(assets, &{&1.public_ref, &1})

    fixture.entries
    |> Enum.filter(&(&1.theme == theme))
    |> Enum.reduce_while({:ok, true}, fn entry, {:ok, true} ->
      compare_fixture_entry(entry, image_by_profile, asset_by_ref, opts)
    end)
  end

  defp active_assets_query(community_id, refs) do
    from(asset in CommunityAsset,
      where: asset.community_id == ^community_id,
      where: asset.status == :active,
      where: asset.public_ref in ^refs
    )
  end

  defp compare_fixture_entry(entry, image_by_profile, asset_by_ref, opts) do
    image = Map.get(image_by_profile, entry.profile)
    asset = image && Map.get(asset_by_ref, image.asset_public_ref)

    case {image, asset} do
      {%WallpaperSnapshotImage{} = image, %CommunityAsset{} = asset} ->
        compare_fixture_asset(entry, image, asset, opts)

      _missing_image_or_asset ->
        {:halt, {:ok, false}}
    end
  end

  defp compare_fixture_asset(entry, image, asset, opts) do
    if fixture_asset_matches?(entry, image, asset) do
      compare_asset_availability(asset, opts)
    else
      {:halt, {:ok, false}}
    end
  end

  defp fixture_asset_matches?(entry, image, asset) do
    image.format == :webp and image.width == entry.width and image.height == entry.height and
      image.checksum == entry.checksum and asset.content_hash == entry.checksum
  end

  defp compare_asset_availability(asset, opts) do
    case asset_object_available?(asset, opts) do
      {:ok, true} -> {:cont, {:ok, true}}
      {:ok, false} -> {:halt, {:ok, false}}
      {:error, reason} -> {:halt, {:error, {:wallpaper_asset_unavailable, reason}}}
    end
  end

  defp asset_object_available?(asset, opts) do
    probe = Keyword.get(opts, :asset_availability_probe, &http_asset_object_available?/1)

    case probe.(asset) do
      value when is_boolean(value) -> {:ok, value}
      {:ok, value} when is_boolean(value) -> {:ok, value}
      {:error, _reason} = error -> error
      other -> {:error, {:invalid_probe_response, other}}
    end
  end

  defp http_asset_object_available?(%CommunityAsset{url: url}) when is_binary(url) do
    case Req.head(url, receive_timeout: 5_000, retry: false) do
      {:ok, %Req.Response{status: status}} when status in 200..299 -> {:ok, true}
      {:ok, %Req.Response{status: 404}} -> {:ok, false}
      {:ok, %Req.Response{status: status}} -> {:error, {:unexpected_status, status}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp http_asset_object_available?(_asset), do: {:ok, false}

  defp load_fixture(manifest_path) do
    with {:ok, raw} <- File.read(manifest_path),
         {:ok, manifest} <- Jason.decode(raw),
         {:ok, version} <- fixture_version(manifest),
         {:ok, entries} <- fixture_entries(manifest, Path.dirname(manifest_path)),
         {:ok, _} <- validate_fixture_profiles(entries) do
      {:ok, %{entries: entries, version: version}}
    else
      {:error, reason} -> {:error, {:wallpaper_fixture_invalid, reason}}
      other -> {:error, {:wallpaper_fixture_invalid, other}}
    end
  end

  defp fixture_version(%{"fixtureVersion" => version}) when is_binary(version) do
    if version == @fixture_version, do: {:ok, version}, else: {:error, :unsupported_version}
  end

  defp fixture_version(_manifest), do: {:error, :version_missing}

  defp fixture_entries(%{"images" => images}, fixture_dir) when is_list(images) do
    Enum.reduce_while(images, {:ok, []}, fn image, {:ok, entries} ->
      case load_fixture_entry(image, fixture_dir) do
        {:ok, entry} -> {:cont, {:ok, [entry | entries]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, entries} -> {:ok, Enum.reverse(entries)}
      error -> error
    end
  end

  defp fixture_entries(_manifest, _fixture_dir), do: {:error, :images_missing}

  defp load_fixture_entry(image, fixture_dir) when is_map(image) do
    with {:ok, theme} <- parse_theme(Map.get(image, "theme")),
         {:ok, profile} <- parse_profile(Map.get(image, "profile")),
         path when is_binary(path) <- Map.get(image, "path"),
         width when is_integer(width) <- Map.get(image, "width"),
         height when is_integer(height) <- Map.get(image, "height"),
         "image/webp" = mime_type <- Map.get(image, "mimeType"),
         checksum when is_binary(checksum) <- Map.get(image, "checksum"),
         {:ok, bytes} <- File.read(Path.join(fixture_dir, path)),
         true <- checksum == checksum_for(bytes) do
      {:ok,
       %{
         bytes: bytes,
         checksum: checksum,
         checksum_sha256: :crypto.hash(:sha256, bytes) |> Base.encode64(),
         height: height,
         mime_type: mime_type,
         profile: profile,
         theme: theme,
         width: width
       }}
    else
      false -> {:error, {:checksum_mismatch, Map.get(image, "path")}}
      _ -> {:error, {:image_entry_invalid, image}}
    end
  end

  defp load_fixture_entry(_image, _fixture_dir), do: {:error, :image_entry_invalid}

  defp validate_fixture_profiles(entries) do
    expected =
      for theme <- @themes, profile <- Wallpaper.profile_specs(), do: {theme, profile.key}

    actual = Enum.map(entries, &{&1.theme, &1.profile})

    if Enum.sort(actual) == Enum.sort(expected) do
      {:ok, :pass}
    else
      {:error, :profile_matrix_invalid}
    end
  end

  defp upload_image_input(entry) do
    %{
      checksum: entry.checksum_sha256,
      height: entry.height,
      mime_type: entry.mime_type,
      profile: entry.profile,
      size_bytes: byte_size(entry.bytes),
      width: entry.width
    }
  end

  defp checksum_for(bytes) do
    "sha256:" <> (:crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower))
  end

  defp parse_theme(theme) when theme in ["light", "dark"] do
    {:ok, String.to_existing_atom(theme)}
  end

  defp parse_theme(_theme), do: {:error, :theme_invalid}

  defp parse_profile(profile) when is_binary(profile) do
    case Enum.find(Wallpaper.profile_specs(), &(Atom.to_string(&1.key) == profile)) do
      %{key: key} -> {:ok, key}
      nil -> {:error, :profile_invalid}
    end
  end

  defp parse_profile(_profile), do: {:error, :profile_invalid}

  defp active_field(:light), do: :active_light_snapshot_ref
  defp active_field(:dark), do: :active_dark_snapshot_ref

  defp seed_command_id(community_id, theme, fixture_version, base_version, phase) do
    GroupherServer.Activity.event_ref_derive({
      :wallpaper_seed,
      fixture_version,
      community_id,
      theme,
      base_version,
      phase
    })
  end

  defp asset_hub(opts) do
    Keyword.get(
      opts,
      :asset_hub,
      Application.get_env(:groupher_server, :wallpaper_seed_asset_hub, __MODULE__.AssetHub)
    )
  end

  defmodule AssetHub do
    @moduledoc """
    Server-side client for the public Assets Hub upload boundary.

    Wallpaper seed
      -> signed upload intent
      -> Assets Hub presign / finalize
      -> current-community asset
    """

    alias GroupherServer.CMS
    alias CMS.Assets.Endpoints

    @timeout 30_000

    @doc false
    def create_batch(capability) when is_binary(capability) do
      post(
        "/generated-batches",
        %{capability: capability},
        fn body -> if match?(%{"ok" => true}, body), do: {:ok, :pass}, else: false end,
        "ASSETS_HUB_BATCH_ENDPOINT"
      )
    end

    @doc false
    def upload(capability, upload_ref, bytes)
        when is_binary(capability) and is_binary(upload_ref) and is_binary(bytes) do
      with {:ok, upload} <- presign(capability),
           {:ok, :pass} <- put(upload, bytes) do
        finalize(upload_ref, capability)
      end
    end

    @doc false
    def cancel_batch(batch_ref, capability) when is_binary(batch_ref) and is_binary(capability) do
      case post(
             "/generated-batches/#{batch_ref}/cancel",
             %{capability: capability},
             fn body -> match?(%{"ok" => true}, body) end,
             "ASSETS_HUB_BATCH_ENDPOINT"
           ) do
        {:ok, _body} -> {:ok, :pass}
        {:error, reason} -> {:error, reason}
      end
    end

    defp presign(capability) do
      post("/uploads", %{capability: capability}, fn
        %{"result" => %{"upload" => upload}} -> {:ok, upload}
        _body -> {:error, :asset_presign_invalid}
      end)
    end

    defp put(%{"url" => url, "method" => "PUT", "headers" => headers}, bytes)
         when is_binary(url) and is_map(headers) do
      case Req.put(url,
             body: bytes,
             headers: Map.to_list(headers),
             receive_timeout: @timeout,
             retry: false
           ) do
        {:ok, %Req.Response{status: status}} when status in 200..299 ->
          {:ok, :pass}

        {:ok, %Req.Response{status: status, body: body}} ->
          {:error, {:asset_put_failed, status, body}}

        {:error, reason} ->
          {:error, {:asset_put_failed, reason}}
      end
    end

    defp put(_upload, _bytes), do: {:error, :asset_presign_invalid}

    defp finalize(upload_ref, capability) do
      post("/uploads/#{upload_ref}/finalize", %{capability: capability}, fn
        %{"ok" => true, "result" => result} -> {:ok, result}
        _body -> {:error, :asset_finalize_invalid}
      end)
    end

    defp post(path, payload, success?, endpoint_key \\ "ASSETS_PUBLIC_ENDPOINT") do
      endpoint = Endpoints.fetch!(endpoint_key)

      case Req.post("#{endpoint}#{path}",
             json: payload,
             receive_timeout: @timeout,
             retry: false
           ) do
        {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
          case success?.(body) do
            true -> {:ok, body}
            {:ok, _value} = result -> result
            false -> {:error, {:assets_hub_invalid_response, path, body}}
            {:error, _reason} = error -> error
          end

        {:ok, %Req.Response{status: status, body: body}} ->
          {:error, {:assets_hub_request_failed, path, status, body}}

        {:error, reason} ->
          {:error, {:assets_hub_request_failed, path, reason}}
      end
    end
  end
end
