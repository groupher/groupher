defmodule GroupherServer.CMS.ContentImport.Persistence.Job.AssetTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Persistence.Job.Asset, as: PersistedAsset
  alias GroupherServer.CMS.ContentImport.Plan.Asset

  test "materializes a pending Plan.Asset without credentials or ephemeral URLs" do
    planned =
      Asset.new!(%{
        asset_key: "asset_logo",
        source: {:entry, "docs/logo.png"},
        source_path: "docs/logo.png",
        references: [%{"externalRef" => "docs/start.md"}]
      })

    changeset = PersistedAsset.from_plan_asset(1, planned)
    assert changeset.valid?

    persisted = Ecto.Changeset.apply_changes(changeset)
    assert persisted.source == %{"type" => "entry", "externalRef" => "docs/logo.png"}
    assert persisted.references == %{"items" => [%{"externalRef" => "docs/start.md"}]}
    refute Map.has_key?(persisted.source, "authorization")
  end

  test "requires staging metadata before an asset becomes ready" do
    asset = %PersistedAsset{
      job_id: 1,
      asset_key: "asset_logo",
      source: %{"type" => "remote_url", "url" => "https://example.com/logo.png"},
      status: :staging
    }

    refute PersistedAsset.transition_changeset(asset, :ready).valid?

    assert PersistedAsset.transition_changeset(asset, :ready, %{
             content_hash: String.duplicate("a", 64),
             staging_ref: "staging://job/logo",
             staged_at: ~U[2026-07-14 02:00:00Z]
           }).valid?
  end
end
