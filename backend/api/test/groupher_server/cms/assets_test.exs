defmodule GroupherServer.Test.CMS.AssetsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.BodyBag
  alias CMS.Hash

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBodyDraft,
    ArticleDraft,
    AssetReplacementPlan,
    Author,
    CommunityAsset
  }

  describe "[cms assets]" do
    setup do
      {community, post, _attrs, user} = mock_article(:post)
      assert {:ok, _draft} = open_draft(post, user)

      {:ok, ~m(community post user)a}
    end

    test "registers community assets and counts active storage once", ~m(community user)a do
      attrs = image_asset_attrs("hero.png", 120)

      {:ok, asset} =
        CMS.Assets.register_to_community(community, attrs, user, Ecto.UUID.generate())

      assert asset.asset_type == :image
      assert asset.uploader_id == user.id
      assert asset.url_hash == Hash.asset_url_hash(attrs.url)

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 120

      {:ok, same_asset} =
        CMS.Assets.register_to_community(
          community,
          Map.merge(attrs, %{size_bytes: 256, title: "updated"}),
          user,
          Ecto.UUID.generate()
        )

      assert same_asset.id == asset.id
      assert same_asset.size_bytes == 256

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 256
    end

    test "deduplicates concurrent registrations by url hash", ~m(community user)a do
      attrs = image_asset_attrs("race.png", 128)
      parent = self()

      tasks =
        for _ <- 1..2 do
          Task.async(fn ->
            send(parent, {:task_ready, self()})

            receive do
              :go ->
                CMS.Assets.register_to_community(community, attrs, user, Ecto.UUID.generate())
            end
          end)
        end

      ready_pids =
        for _ <- tasks do
          assert_receive {:task_ready, pid}
          pid
        end

      Enum.each(ready_pids, &send(&1, :go))

      assets =
        Enum.map(tasks, fn task ->
          {:ok, asset} = Task.await(task, 5_000)
          asset
        end)

      assert assets |> Enum.map(& &1.id) |> Enum.uniq() |> length() == 1

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 128
    end

    test "deduplicates registered storage objects when url changes", ~m(community user)a do
      attrs =
        "signed-a.png"
        |> image_asset_attrs(64)
        |> Map.merge(%{storage: "s3", storage_key: "community/assets/signed.png"})

      {:ok, asset} =
        CMS.Assets.register_to_community(community, attrs, user, Ecto.UUID.generate())

      {:ok, same_asset} =
        CMS.Assets.register_to_community(
          community,
          Map.merge(attrs, %{url: "https://assets.groupher.test/signed-b.png", size_bytes: 96}),
          user,
          Ecto.UUID.generate()
        )

      assert same_asset.id == asset.id
      assert same_asset.url == "https://assets.groupher.test/signed-b.png"
      assert same_asset.size_bytes == 96

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 1
      assert usage.storage_bytes == 96
    end

    test "links article document refs without changing storage ownership",
         ~m(community post user)a do
      body_asset = image_asset_attrs("body.png", 100)
      cover_asset = image_asset_attrs("cover.png", 200)

      assert {:ok, %{body: [_], cover: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{
                       asset: body_asset,
                       block_id: "block-image-1",
                       block_type: "image",
                       alt: "body image"
                     }
                   ],
                   cover_asset: cover_asset
                 },
                 community: community
               )

      refs = article_refs(:post, post.id)
      assert refs |> Enum.map(& &1.usage) |> Enum.sort() == [:cover, :inline]
      body_ref = Enum.find(refs, &(&1.usage == :inline))
      assert body_ref.block_id == "block-image-1"

      {:ok, summary} = CMS.Assets.usage_summary(community, body_ref.asset_id, user)
      assert summary.draft == 1
      assert summary.live == 0
      assert summary.historical == 0
      assert summary.trashed == 0

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 2
      assert usage.storage_bytes == 300

      assert {:ok, %{body: [], cover: []}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   asset_refs: [],
                   cover_edit_info: nil
                 },
                 community: community
               )

      assert article_refs(:post, post.id) == []

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 2
      assert usage.storage_bytes == 300
    end

    test "linking refs replaces removed assets and keeps retained assets",
         ~m(community post user)a do
      {:ok, asset_a} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("replace-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, asset_b} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("replace-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      {:ok, asset_c} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("replace-c.png", 30),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{asset_id: asset_a.id, block_id: "asset-a"},
                     %{asset_id: asset_b.id, block_id: "asset-b"}
                   ]
                 },
                 community: community
               )

      assert refs |> Enum.map(& &1.asset_id) |> Enum.sort() == [asset_a.id, asset_b.id]
      assert asset_ref_count(asset_a.id) == 1
      assert asset_ref_count(asset_b.id) == 1
      assert asset_ref_count(asset_c.id) == 0

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{asset_id: asset_b.id, block_id: "asset-b"},
                     %{asset_id: asset_c.id, block_id: "asset-c"}
                   ]
                 },
                 community: community
               )

      assert refs |> Enum.map(& &1.asset_id) |> Enum.sort() == [asset_b.id, asset_c.id]

      assert article_refs(:post, post.id) |> Enum.map(& &1.asset_id) |> Enum.sort() == [
               asset_b.id,
               asset_c.id
             ]

      assert asset_ref_count(asset_a.id) == 0
      assert asset_ref_count(asset_b.id) == 1
      assert asset_ref_count(asset_c.id) == 1
    end

    test "replaces one Draft asset use with a version and source guard",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("one-use-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("one-use-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "replace-me"}]},
                 community: community
               )

      draft = Repo.get_by!(ArticleDraft, article_id: post.id)
      body = Repo.get!(ArticleBodyDraft, draft.body_draft_id)
      {:ok, body_bag} = BodyBag.from_document(body)
      workflow_ref = "asset-replacement:test:#{post.id}"

      assert {:ok, %{draft_version: version, workflow_ref: ^workflow_ref}} =
               CMS.Assets.replace_use(
                 post,
                 %{
                   expected_draft_version: draft.version,
                   usage: :inline,
                   block_id: "replace-me",
                   from_asset_id: from_asset.id,
                   to_asset_id: to_asset.id,
                   body_bag: body_bag
                 },
                 user,
                 {:workflow, workflow_ref}
               )

      assert version == draft.version + 1
      assert [%ArticleAssetRef{asset_id: asset_id}] = article_refs(:post, post.id)
      assert asset_id == to_asset.id

      assert {:ok, %{draft_version: ^version, workflow_ref: ^workflow_ref}} =
               CMS.Assets.replace_use(
                 post,
                 %{
                   expected_draft_version: draft.version,
                   usage: :inline,
                   block_id: "replace-me",
                   from_asset_id: from_asset.id,
                   to_asset_id: to_asset.id,
                   body_bag: body_bag
                 },
                 user,
                 {:workflow, workflow_ref}
               )
    end

    test "creates a global replacement plan from observed usage facts",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("plan-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("plan-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "plan-block"}]},
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{status: :pending, items: [item]}} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert (item[:article_id] || item["article_id"]) == post.id
      assert (item[:observed_draft_version] || item["observed_draft_version"]) == 1
      assert (item[:decision] || item["decision"]) == "editable"
      locators = item[:usage_locators] || item["usage_locators"]
      assert [%{block_id: "plan-block"}] = locators
    end

    test "replacement plan persists step completion and resumes idempotently",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("resume-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("resume-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "resume-block"}]},
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{} = plan} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      draft = Repo.get_by!(ArticleDraft, article_id: post.id)
      body = Repo.get!(ArticleBodyDraft, draft.body_draft_id)
      {:ok, body_bag} = BodyBag.from_document(body)

      assert {:ok, %AssetReplacementPlan{status: :completed, apply_run_ref: run_ref} = applied} =
               CMS.Assets.apply_replacement_plan(plan, user, body_bags: %{post.id => body_bag})

      assert is_binary(run_ref)
      [item] = applied.items
      [locator] = item[:usage_locators] || item["usage_locators"]
      assert (locator[:status] || locator["status"]) == "succeeded"

      assert {:ok, %AssetReplacementPlan{status: :completed, apply_run_ref: ^run_ref}} =
               CMS.Assets.apply_replacement_plan(applied, user, body_bags: %{post.id => body_bag})
    end

    test "rejects refs with both asset_id and inline asset", ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("existing.png", 50),
          user,
          Ecto.UUID.generate()
        )

      assert {:error,
              %ErrorCat.Error{
                reason: :custom,
                details: "asset_id and asset are mutually exclusive"
              }} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{
                       asset_id: asset.id,
                       asset: image_asset_attrs("ignored.png", 60)
                     }
                   ]
                 },
                 community: community
               )

      assert article_refs(:post, post.id) == []
    end

    test "rejects cover usages in body asset refs without changing cover refs",
         ~m(community post user)a do
      cover_asset = image_asset_attrs("body-usage-cover.png", 100)

      assert {:ok, %{body: [], cover: [cover_ref]}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   cover_asset: cover_asset
                 },
                 community: community
               )

      for usage <- [:cover, "cover_dark"] do
        assert {:error, %ErrorCat.Error{reason: :custom, details: "asset usage is invalid"}} =
                 CMS.Assets.link_refs(
                   post,
                   %{
                     cur_user: user,
                     asset_refs: [
                       %{
                         asset: image_asset_attrs("invalid-body-#{usage}.png", 40),
                         usage: usage
                       }
                     ]
                   },
                   community: community
                 )

        assert [%ArticleAssetRef{id: ref_id, usage: :cover}] =
                 article_refs(:post, post.id)

        assert ref_id == cover_ref.id
      end
    end

    test "serializes concurrent ref linking for the same document", ~m(community post user)a do
      parent = self()

      tasks =
        ["sync-a.png", "sync-b.png"]
        |> Enum.with_index()
        |> Enum.map(fn {filename, index} ->
          Task.async(fn ->
            send(parent, {:task_ready, self()})

            receive do
              :go ->
                CMS.Assets.link_refs(
                  post,
                  %{
                    cur_user: user,
                    asset_refs: [
                      %{
                        asset: image_asset_attrs(filename, 20 + index),
                        source: filename
                      }
                    ]
                  },
                  community: community
                )
            end
          end)
        end)

      ready_pids =
        for _ <- tasks do
          assert_receive {:task_ready, pid}
          pid
        end

      Enum.each(ready_pids, &send(&1, :go))

      Enum.each(tasks, fn task ->
        assert {:ok, %{body: [_], cover: []}} = Task.await(task, 5_000)
      end)

      refs = article_refs(:post, post.id)

      assert length(refs) == 1
      assert hd(refs).source in ["sync-a.png", "sync-b.png"]
    end

    test "paginates refs for one asset", ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("many-refs.png", 70),
          user,
          Ecto.UUID.generate()
        )

      asset_refs =
        Enum.map(1..105, fn position ->
          %{asset_id: asset.id, position: position}
        end)

      assert {:ok, %{body: refs, cover: []}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: asset_refs
                 },
                 community: community
               )

      assert length(refs) == 105

      {:ok, paged_refs} = CMS.Assets.refs(community, asset.id, %{page: 1, size: 20})

      assert length(paged_refs.entries) == 20
      assert paged_refs.total_count == 105
      assert paged_refs.total_pages == 6
      assert paged_refs.page_number == 1

      {:ok, second_page_refs} = CMS.Assets.refs(community, asset.id, %{page: 2, size: 20})

      assert length(second_page_refs.entries) == 20
      assert second_page_refs.total_count == 105
      assert second_page_refs.total_pages == 6
      assert second_page_refs.page_number == 2

      first_page_ids = paged_refs.entries |> Enum.map(& &1.id) |> MapSet.new()
      second_page_ids = second_page_refs.entries |> Enum.map(& &1.id) |> MapSet.new()

      assert MapSet.disjoint?(first_page_ids, second_page_ids)
    end

    test "creates upload intent with readable refs and dated storage key", ~m(community user)a do
      {:ok, intent} =
        CMS.Assets.create_upload_intent(
          community,
          image_asset_attrs("upload-intent.png", 80),
          user
        )

      assert intent.upload_ref =~ ~r/^upload_[A-Za-z0-9]{18}$/
      assert intent.asset_public_ref =~ ~r/^asset_[A-Za-z0-9]{18}$/

      asset_uid = String.replace_prefix(intent.asset_public_ref, "asset_", "")

      assert intent.object_key =~
               ~r/^communities\/#{community.slug}\/assets\/\d{4}_\d{2}\/\d{2}_#{asset_uid}\/original$/

      assert intent.capability |> String.split(".") |> length() == 2
      [encoded_payload, _signature] = String.split(intent.capability, ".")
      assert {:ok, payload_json} = Base.url_decode64(encoded_payload, padding: false)
      payload = Jason.decode!(payload_json)

      assert payload["uploadRef"] == intent.upload_ref
      assert payload["assetPublicRef"] == intent.asset_public_ref
      assert payload["objectKey"] == intent.object_key
      assert payload["canonicalUrl"] =~ "/a/#{intent.asset_public_ref}/original"
      assert payload["declaredFilename"] == "upload-intent.png"
      assert payload["declaredMimeType"] == "image/png"
      assert payload["declaredSizeBytes"] == 80
    end

    test "rejects upload intent when community quota is exhausted", ~m(community user)a do
      {:ok, _asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("quota-full.png", 100 * 1024 * 1024),
          user,
          Ecto.UUID.generate()
        )

      assert {:error,
              %ErrorCat.Error{
                reason: :custom,
                details: "community asset storage quota exceeded"
              }} =
               CMS.Assets.create_upload_intent(
                 community,
                 image_asset_attrs("quota-next.png", 1),
                 user
               )
    end

    test "rejects upload completion when community quota is exhausted", ~m(community user)a do
      {:ok, _asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("quota-complete-full.png", 100 * 1024 * 1024),
          user,
          Ecto.UUID.generate()
        )

      assert {:error,
              %ErrorCat.Error{
                reason: :custom,
                details: "community asset storage quota exceeded"
              }} =
               CMS.Assets.complete_upload(%{
                 asset_public_ref: "asset_quota_complete",
                 community_id: community.id,
                 content_hash: "sha256:quota-complete",
                 filename: "quota-complete-next.png",
                 mime_type: "image/png",
                 size_bytes: 1,
                 storage: "r2",
                 storage_key: "communities/#{community.slug}/assets/2026_07/30_quota/original",
                 url: "https://assets.groupher.test/a/asset_quota_complete/original",
                 uploader_id: user.id
               })
    end

    test "returns origin info only for active public refs", ~m(community user)a do
      attrs =
        "origin.png"
        |> image_asset_attrs(120)
        |> Map.merge(%{
          asset_type: :image,
          content_hash: "sha256:origin",
          meta: %{variants: ["original", "thumbnail", "card"]},
          public_ref: "asset_origin_active",
          storage: "r2",
          storage_key: "communities/groupher/assets/2026_07/29_origin_active/original"
        })

      {:ok, asset} =
        CMS.Assets.register_to_community(community, attrs, user, Ecto.UUID.generate())

      assert {:ok, origin_info} = CMS.Assets.origin_info(asset.public_ref)
      assert origin_info.public_ref == "asset_origin_active"
      assert origin_info.storage == "r2"

      assert origin_info.storage_key ==
               "communities/groupher/assets/2026_07/29_origin_active/original"

      assert origin_info.mime_type == "image/png"
      assert origin_info.size_bytes == 120
      assert origin_info.width == 1200
      assert origin_info.height == 630

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)
      {:ok, deleted_asset} = CMS.Assets.delete(community, asset.id, user, Ecto.UUID.generate())
      assert deleted_asset.status == :deleted

      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :asset},
                reason: :not_exist,
                details: "asset not found"
              }} =
               CMS.Assets.origin_info(asset.public_ref)

      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :asset},
                reason: :not_exist,
                details: "asset not found"
              }} =
               CMS.Assets.origin_info("asset_missing")
    end

    test "archive hides an asset and restore makes it selectable again", ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("archive-me.png", 80),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, archived} =
               CMS.Assets.archive(community, asset.id, user, Ecto.UUID.generate())

      assert archived.status == :archived
      assert {:ok, %{entries: entries}} = CMS.Assets.page(community, %{page: 1, size: 20})
      refute Enum.any?(entries, &(&1.id == asset.id))

      assert {:ok, restored} =
               CMS.Assets.restore(community, asset.id, user, Ecto.UUID.generate())

      assert restored.status == :active
      assert {:ok, %{entries: entries}} = CMS.Assets.page(community, %{page: 1, size: 20})
      assert Enum.any?(entries, &(&1.id == asset.id))
    end

    test "gc candidates require completeness and a safety window", ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("gc-me.png", 80),
          user,
          Ecto.UUID.generate()
        )

      assert {:error, %ErrorCat.Error{details: "asset usage backfill incomplete"}} =
               CMS.Assets.gc_candidates(community, safety_window_seconds: 0)

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)

      assert {:ok, candidates} =
               CMS.Assets.gc_candidates(community, safety_window_seconds: 0)

      assert Enum.any?(candidates, &(&1.asset.id == asset.id))
    end

    test "provider reconciliation scans bounded pages for orphan identities",
         ~m(community user)a do
      {:ok, _asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("provider-owned.png", 80)
          |> Map.merge(%{storage: "r2", storage_key: "owned/original"}),
          user,
          Ecto.UUID.generate()
        )

      provider_page = fn cursor, limit ->
        assert cursor == nil
        assert limit == 1

        {:ok,
         %{
           objects: [
             %{"storage" => "r2", "storageKey" => "orphan/original"},
             %{"storage" => "r2", "storageKey" => "owned/original"}
           ],
           next_cursor: "next"
         }}
      end

      assert {:ok, %{orphans: [%{"storageKey" => "orphan/original"}], next_cursor: "next"}} =
               CMS.Assets.ProviderReconciliation.scan_provider_orphans(
                 community,
                 provider_page,
                 limit: 1,
                 grace_seconds: 0
               )
    end

    test "does not delete assets that are still referenced", ~m(community post user)a do
      asset_attrs = image_asset_attrs("referenced.png", 80)

      {:ok, %{body: [ref]}} =
        CMS.Assets.link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [%{asset: asset_attrs, block_id: "referenced"}]
          },
          community: community
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)

      assert {:error,
              %ErrorCat.Error{
                reason: :custom,
                details: "asset is still referenced"
              }} =
               CMS.Assets.delete(community, ref.asset_id, user, Ecto.UUID.generate())

      assert {:ok, %CommunityAsset{}} = ORM.find(CommunityAsset, ref.asset_id)
    end

    test "soft-deleting an article keeps document asset refs", ~m(community post user)a do
      asset_attrs = image_asset_attrs("soft-delete-keeps-refs.png", 90)

      {:ok, %{body: [ref]}} =
        CMS.Assets.link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [%{asset: asset_attrs, block_id: "soft-delete-keeps-refs"}]
          },
          community: community
        )

      assert asset_ref_count(ref.asset_id) == 1

      assert {:ok, _trash_item} = CMS.Articles.trash(post, user)

      assert asset_ref_count(ref.asset_id) == 1
      assert [_] = article_refs(:post, post.id)
    end

    test "permanently deleting an article cleans up document asset refs",
         ~m(community post user)a do
      asset_attrs = image_asset_attrs("delete-cleanup.png", 90)

      {:ok, %{body: [ref]}} =
        CMS.Assets.link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [%{asset: asset_attrs, block_id: "delete-cleanup"}]
          },
          community: community
        )

      assert [_] = article_refs(:post, post.id)

      assert {:ok, trash_item} = CMS.Articles.trash(post, user)
      assert asset_ref_count(ref.asset_id) == 1

      assert {:ok, %{done: true}} =
               CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

      assert article_refs(:post, post.id) == []
      assert asset_ref_count(ref.asset_id) == 0
      assert {:ok, %CommunityAsset{}} = ORM.find(CommunityAsset, ref.asset_id)
    end

    test "permanently deleting one article keeps shared asset refs from other articles",
         ~m(community post user)a do
      {_community, other_post, _attrs, _user} = mock_article(:post, community, user)
      assert {:ok, _draft} = open_draft(other_post, user)

      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("shared.png", 90),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [%{asset_id: asset.id, block_id: "shared-one"}]
                 },
                 community: community
               )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 other_post,
                 %{
                   cur_user: user,
                   asset_refs: [%{asset_id: asset.id, block_id: "shared-two"}]
                 },
                 community: community
               )

      assert asset_ref_count(asset.id) == 2

      assert {:ok, trash_item} = CMS.Articles.trash(post, user)

      assert {:ok, %{done: true}} =
               CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

      assert asset_ref_count(asset.id) == 1
      assert article_refs(:post, post.id) == []
      assert [_] = article_refs(:post, other_post.id)
    end
  end

  defp image_asset_attrs(filename, size_bytes) do
    %{
      url: "https://assets.groupher.test/#{filename}",
      filename: filename,
      mime_type: "image/png",
      size_bytes: size_bytes,
      width: 1200,
      height: 630
    }
  end

  defp open_draft(article_view, user) do
    article = Repo.get!(Article, article_view.article_id)
    author = Repo.get_by!(Author, user_id: user.id)
    CMS.Articles.Draft.Store.ensure_from_public(article, author)
  end

  defp article_refs(thread, article_id) do
    ArticleAssetRef
    |> join(:left, [ref], draft in CMS.Model.ArticleDraft,
      on: draft.body_draft_id == ref.body_draft_id
    )
    |> join(:left, [ref, _draft], revision in CMS.Model.ArticleRevision,
      on: revision.id == ref.revision_id
    )
    |> join(:inner, [ref, draft, revision], article in Article,
      on: article.id == draft.article_id or article.id == revision.article_id
    )
    |> where(
      [_ref, _draft, _revision, article],
      article.thread == ^thread and article.id == ^article_id
    )
    |> order_by([ref], asc: ref.usage)
    |> Repo.all()
  end

  defp asset_ref_count(asset_id) do
    ArticleAssetRef
    |> where([ref], ref.asset_id == ^asset_id)
    |> Repo.aggregate(:count, :id)
  end
end
