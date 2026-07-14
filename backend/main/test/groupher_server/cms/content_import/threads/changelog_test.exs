defmodule GroupherServer.CMS.ContentImport.Threads.ChangelogTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Articles.{Branch, Draft}
  alias GroupherServer.CMS.ContentImport.{ApplyResult, Mapping, Plan, Preview}
  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Releases
  alias GroupherServer.CMS.ContentImport.Plan.Asset
  alias GroupherServer.CMS.ContentImport.Preview.Item, as: PreviewItem
  alias GroupherServer.CMS.ContentImport.Threads.Changelog
  alias GroupherServer.CMS.ContentImport.Threads.Changelog.{ItemPreview, PreviewPayload}
  alias GroupherServer.CMS.Model.ArticleBranch

  defmodule Client do
    def fetch_releases(connection, _opts), do: {:ok, Map.fetch!(connection, :releases)}
  end

  test "plans GitHub Releases and applies create/update only to Changelog Draft" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()
    first_snapshot = snapshot([release(101, "v1.0.0", "Version 1", "Initial release notes")])

    assert {:ok, %Plan{} = first_plan} =
             Changelog.plan(
               first_snapshot,
               %{community_ref: community.slug, thread: :changelog},
               %{mappings: [], options: [id_generator: fn -> target_ref end]}
             )

    assert [item] = first_plan.items
    assert item.external_ref == "github_release:101"
    assert item.target_ref == target_ref
    assert item.action == :create
    assert item.payload.tag_name == "v1.0.0"
    assert item.payload.published_at == "2026-07-10T12:00:00Z"
    assert item.payload.prerelease == false
    assert item.payload.content["status"] == "normalized"

    assert {:ok,
            %Preview{
              payload: %PreviewPayload{},
              items: [%PreviewItem{payload: %ItemPreview{} = item_preview}]
            }} = Changelog.project_preview(first_plan)

    refute Map.has_key?(Map.from_struct(item_preview), :content)

    assert {:ok, %ApplyResult{items: [%{status: :created}]}} =
             apply_in_transaction(first_plan, actor, community: community)

    {:ok, main} = Branch.resolve(community, :changelog, Branch.main_slug())
    assert {:ok, draft} = Draft.read(community, :changelog, target_ref, main)
    assert draft.title == "Version 1"
    assert draft.link_addr =~ "/releases/tag/v1.0.0"
    assert draft.active_at == ~U[2026-07-10 12:00:00Z]
    assert {:error, _} = Draft.read_public(community, :changelog, target_ref, main)

    mapping =
      Mapping.new!(%{
        connection_ref: "connection:releases",
        external_ref: "github_release:101",
        thread: :changelog,
        target_ref: target_ref
      })

    updated_snapshot =
      snapshot([release(101, "v1.0.0", "Version 1 updated", "Updated release notes")])

    assert {:ok, %Plan{} = update_plan} =
             Changelog.plan(
               updated_snapshot,
               %{community_ref: community.slug, thread: :changelog},
               %{mappings: [mapping], options: []}
             )

    assert [%{action: :update, target_ref: ^target_ref}] = update_plan.items

    assert {:ok, %ApplyResult{items: [%{status: :updated}]}} =
             apply_in_transaction(update_plan, actor, community: community)

    assert {:ok, updated} = Draft.read(community, :changelog, target_ref, main)
    assert updated.title == "Version 1 updated"
    assert Repo.preload(updated, :document).document.plain_text =~ "Updated release notes"
  end

  test "discovers release body assets during plan and resolves them before Draft write" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()

    body = "Release notes with image ![logo](https://cdn.example.com/logo.png)"
    snapshot = snapshot([release(101, "v1.0.0", "Version 1", body)])

    assert {:ok, %Plan{} = plan} =
             Changelog.plan(
               snapshot,
               %{community_ref: community.slug, thread: :changelog},
               %{mappings: [], options: [id_generator: fn -> target_ref end]}
             )

    assert [%Asset{status: :pending} = pending] = plan.assets

    assert {:error, [%{code: "changelog_assets_not_ready"}]} =
             apply_in_transaction(plan, actor, community: community)

    {:ok, staging} = Asset.transition(pending, :staging)

    {:ok, ready} =
      Asset.transition(staging, :ready, %{
        content_hash: String.duplicate("a", 64),
        staging_ref: "staging://release-logo"
      })

    resolver = fn asset, resolved_community, resolved_actor, _opts ->
      assert asset.asset_key == ready.asset_key
      assert resolved_community.id == community.id
      assert resolved_actor.id == actor.id

      {:ok,
       %{
         target_ref: "asset:release-logo",
         url: "https://assets.example.com/release-logo.png",
         status: :created
       }}
    end

    assert {:ok, %ApplyResult{assets: [%{status: :created}]}} =
             apply_in_transaction(%{plan | assets: [ready]}, actor,
               community: community,
               asset_resolver: resolver
             )

    {:ok, main} = Branch.resolve(community, :changelog, Branch.main_slug())
    {:ok, draft} = Draft.read(community, :changelog, target_ref, main)
    document = Repo.preload(draft, :document).document

    assert document.json =~ "https://assets.example.com/release-logo.png"
    refute document.json =~ "content-import://asset/"
  end

  test "dry-run accepts pending assets without creating the main Changelog branch" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    target_ref = Ecto.UUID.generate()
    body = "Release notes ![logo](https://cdn.example.com/logo.png)"
    snapshot = snapshot([release(101, "v1.0.0", "Version 1", body)])

    assert {:ok, %Plan{} = plan} =
             Changelog.plan(
               snapshot,
               %{community_ref: community.slug, thread: :changelog},
               %{mappings: [], options: [id_generator: fn -> target_ref end]}
             )

    assert {:ok, %ApplyResult{items: [%{status: :skipped}]}} =
             apply_in_transaction(plan, actor, community: community, dry_run: true)

    refute Repo.get_by(ArticleBranch,
             community_id: community.id,
             thread: :changelog,
             slug: Branch.main_slug()
           )
  end

  defp snapshot(releases) do
    assert {:ok, snapshot} =
             Releases.fetch(
               %{owner: "groupher", repo: "groupher", releases: releases},
               client: Client,
               fetched_at: ~U[2026-07-14 00:00:00Z]
             )

    snapshot
  end

  defp release(id, tag, name, body) do
    %{
      "id" => id,
      "tag_name" => tag,
      "name" => name,
      "body" => body,
      "html_url" => "https://github.com/groupher/groupher/releases/tag/#{tag}",
      "draft" => false,
      "prerelease" => false,
      "created_at" => "2026-07-10T10:00:00Z",
      "published_at" => "2026-07-10T12:00:00Z",
      "updated_at" => "2026-07-10T12:00:00Z"
    }
  end

  defp apply_in_transaction(plan, actor, opts) do
    Repo.transaction(fn ->
      case Changelog.apply_in_transaction(plan, actor, opts) do
        {:ok, result} -> result
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end
end
