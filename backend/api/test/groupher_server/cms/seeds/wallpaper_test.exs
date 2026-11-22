defmodule GroupherServer.Test.CMS.Seeds.WallpaperTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Assets.{Capability, Maintenance.GeneratedBatch.PublishCapability}
  alias CMS.Model.{CommunityAsset, WallpaperSnapshot, WallpaperSnapshotImage}
  alias CMS.Seeds.Wallpaper, as: WallpaperSeed
  alias CMS.Wallpaper

  defmodule FakeAssetHub do
    alias GroupherServer.CMS
    alias CMS.Assets.Capability

    def create_batch(capability) do
      {:ok, payload} = Capability.verify(capability)
      Process.put(:wallpaper_seed_batch_payload, payload)
      Process.put(:wallpaper_seed_manifest, [])
      {:ok, :pass}
    end

    def upload(capability, upload_ref, bytes) do
      {:ok, payload} = Capability.verify(capability)

      assert payload["purpose"] == "generated_image"
      assert payload["uploadRef"] == upload_ref

      checksum = "sha256:" <> (:crypto.hash(:sha256, bytes) |> Base.encode16(case: :lower))

      {:ok, _asset} =
        CMS.Assets.complete_upload(%{
          asset_public_ref: payload["assetPublicRef"],
          asset_type: :image,
          community_id: payload["communityId"],
          content_hash: checksum,
          filename: payload["declaredFilename"],
          height: payload["declaredHeight"],
          idempotency_key: upload_ref,
          meta: %{},
          mime_type: payload["declaredMimeType"],
          size_bytes: byte_size(bytes),
          storage: "r2",
          storage_key: payload["objectKey"],
          thread: :post,
          upload_ref: upload_ref,
          uploader_id: payload["uploaderId"],
          url: payload["canonicalUrl"],
          width: payload["declaredWidth"]
        })

      entry = %{
        "assetPublicRef" => payload["assetPublicRef"],
        "candidateOwnerRef" => payload["candidateOwnerRef"],
        "checksum" => checksum,
        "height" => payload["declaredHeight"],
        "mimeType" => payload["declaredMimeType"],
        "storageKey" => payload["objectKey"],
        "variantKey" => payload["variantKey"],
        "width" => payload["declaredWidth"]
      }

      Process.put(:wallpaper_seed_manifest, [entry | Process.get(:wallpaper_seed_manifest)])
      {:ok, %{"asset" => %{"publicRef" => payload["assetPublicRef"]}}}
    end

    def cancel_batch(_batch_ref, _capability), do: {:ok, :pass}
  end

  defmodule FakeBatchClient do
    alias GroupherServer.CMS
    alias CMS.Assets.{Capability, Maintenance.GeneratedBatch.PublishCapability}

    def claim_for_publish(batch_ref, command_id) do
      batch = Process.get(:wallpaper_seed_batch_payload)
      manifest = Process.get(:wallpaper_seed_manifest) |> Enum.reverse()

      payload = %{
        "batchRef" => batch["batchRef"],
        "claimKey" => command_id,
        "expiresAt" => "2099-01-01T00:00:00Z",
        "manifest" => manifest,
        "manifestDigest" => manifest_digest(manifest),
        "policyVersion" => "v1",
        "purpose" => "generated_image_publish",
        "requestDigest" => batch["requestDigest"],
        "requestDigestVersion" => batch["requestDigestVersion"],
        "signingKeyId" => "hmac-v1"
      }

      assert payload["batchRef"] == batch_ref
      {:ok, %{"capability" => Capability.sign(payload)}}
    end

    def delete_claim(_batch_ref, _token), do: {:ok, :pass}

    defp manifest_digest(manifest) do
      canonical =
        Enum.map(manifest, fn entry ->
          %{
            asset_public_ref: entry["assetPublicRef"],
            candidate_owner_ref: entry["candidateOwnerRef"],
            checksum: entry["checksum"],
            height: entry["height"],
            mime_type: entry["mimeType"],
            storage_key: entry["storageKey"],
            variant_key: entry["variantKey"],
            width: entry["width"]
          }
        end)

      PublishCapability.manifest_digest(canonical)
    end
  end

  setup do
    {:ok, user} = CMS.Seeds.Helper.seed_bot()
    {:ok, community} = CMS.Communities.create(mock_attrs(:community), user, Ecto.UUID.generate())

    Application.put_env(:groupher_server, :wallpaper_batch_client, FakeBatchClient)

    on_exit(fn ->
      Application.delete_env(:groupher_server, :wallpaper_batch_client)
      Process.delete(:wallpaper_seed_batch_payload)
      Process.delete(:wallpaper_seed_manifest)
    end)

    {:ok, community: community}
  end

  test "publishes the versioned fixture through upload and publish boundaries", %{
    community: community
  } do
    opts = [
      asset_availability_probe: fn _asset -> {:ok, true} end,
      asset_hub: FakeAssetHub
    ]

    assert {:ok, :pass} = WallpaperSeed.seed(community, opts)

    wallpaper = Wallpaper.wallpaper(community.id)
    assert wallpaper.version == 2

    snapshots = Repo.all(WallpaperSnapshot) |> Enum.filter(&(&1.community_id == community.id))
    assert length(snapshots) == 2
    assert Enum.all?(snapshots, &(&1.fixture_version == "default-v1"))

    snapshot_refs = Enum.map(snapshots, & &1.public_ref)

    images =
      Repo.all(WallpaperSnapshotImage)
      |> Enum.filter(&(&1.wallpaper_snapshot_ref in snapshot_refs))

    assert length(images) == 8
    assert Repo.aggregate(
             from(asset in CommunityAsset, where: asset.community_id == ^community.id),
             :count,
             :id
           ) == 8

    assert {:ok, :pass} = WallpaperSeed.seed(community, opts)
    assert Wallpaper.wallpaper(community.id).version == 2

    Enum.each(snapshots, fn snapshot ->
      snapshot
      |> Ecto.Changeset.change(fixture_version: nil)
      |> Repo.update!()
    end)

    assert {:ok, :pass} = WallpaperSeed.seed(community, opts)
    assert Wallpaper.wallpaper(community.id).version == 4
  end
end
