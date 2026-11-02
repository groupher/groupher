defmodule GroupherServer.Test.CMS.AssetsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.BodyBag
  alias CMS.Assets.ThreadIdentity
  alias CMS.Hash

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleBodyDraft,
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    AssetUpload,
    AssetReplacementPlan,
    AssetWorkflowRun,
    AssetWorkflowStep,
    Author,
    CommunityAsset,
    CommunityApplicationLogoUpload,
    DocBranchState
  }

  describe "[cms assets]" do
    setup do
      {community, post, _attrs, user} = mock_article(:post)
      assert {:ok, _draft} = open_draft(post, user)

      {:ok, ~m(community post user)a}
    end

    test "asset pages share stable identity across both APIs and isolate filters",
         ~m(community user)a do
      assets =
        for n <- 1..3 do
          {:ok, asset} =
            CMS.Assets.register_to_community(
              community,
              image_asset_attrs("pagi-#{n}.png", 70),
              user,
              Ecto.UUID.generate()
            )

          asset
        end

      assert {:ok, %{entries: first, total_count: 3}} =
               CMS.Assets.page(community, %{}, %{offset: %{page: 1, size: 2}})

      assert {:ok, %{entries: same, end_cursor: cursor}} =
               CMS.Assets.page(community, %{}, %{cursor: %{first: 2}})

      assert Enum.map(first, & &1.id) == Enum.map(same, & &1.id)

      assert {:ok, %{entries: tail, has_next_page: false}} =
               CMS.Assets.page(community, %{}, %{cursor: %{first: 2, after: cursor}})

      assert MapSet.new(Enum.map(first ++ tail, & &1.id)) == MapSet.new(Enum.map(assets, & &1.id))

      assert {:error, _} =
               CMS.Assets.page(community, %{query: "pagi-1"}, %{
                 cursor: %{first: 2, after: cursor}
               })
    end

    test "asset thread identity includes Ticket without expanding ordinary Article threads",
         ~m(community)a do
      assert {:ok, :ticket} = ThreadIdentity.to_atom("TICKET")
      assert :ticket in ThreadIdentity.values()
      refute :ticket in CMS.Artiment.Threads.article_enums()

      assert {:error, :invalid_asset_thread} =
               CMS.Assets.page(community, %{thread: "not-a-thread"}, %{
                 offset: %{page: 1, size: 10}
               })
    end

    test "Ticket asset usage is Gate-scoped, cloned from a public Post, and protects deletion",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("ticket-source-ref.png", 96),
          user,
          Ecto.UUID.generate()
        )

      public = Repo.get_by!(ArticlePublic, article_id: post.id)

      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: asset.id,
        revision_id: public.revision_id,
        usage: :inline,
        block_id: "ticket-source-ref"
      })
      |> Repo.insert!()

      grants =
        ~w(ticket.create ticket.read_internal ticket.update ticket.manage_visibility)
        |> Map.new(&{&1, true})

      ticket_actor = %{
        user
        | cur_passport: %{
            "global" => %{},
            community.slug => %{"cms" => grants}
          }
      }

      assert {:ok, ticket} =
               CMS.Tickets.create_from_post(
                 community,
                 post.id,
                 %{title: "Ticket with inherited asset"},
                 ticket_actor,
                 Ecto.UUID.generate()
               )

      ticket_article = Repo.get!(Article, ticket.id)
      ticket_draft = Repo.get_by!(ArticleDraft, article_id: ticket.id)

      assert [%ArticleAssetRef{asset_id: asset_id}] =
               Repo.all(
                 from(ref in ArticleAssetRef,
                   where: ref.body_draft_id == ^ticket_draft.body_draft_id
                 )
               )

      assert asset_id == asset.id

      assert {:ok, internal_usages} = CMS.Assets.usages(community, asset.id, ticket_actor)
      assert Enum.any?(internal_usages, &(&1.thread == :ticket and &1.lifecycle == :draft))
      assert Enum.any?(internal_usages, &(&1.thread == :post and &1.lifecycle == :live))

      assert {:ok, public_usages} = CMS.Assets.usages(community, asset.id, nil)
      refute Enum.any?(public_usages, &(&1.thread == :ticket))

      assert {:ok, internal} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)

      assert {:ok, _published} =
               CMS.Tickets.publish(
                 community,
                 ticket.id,
                 "Reviewed Ticket assets",
                 internal.draft_version,
                 internal.lifecycle_version,
                 internal.workflow_version,
                 ticket_actor,
                 Ecto.UUID.generate(),
                 CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
               )

      assert {:ok, internal_usages} = CMS.Assets.usages(community, asset.id, ticket_actor)
      assert Enum.any?(internal_usages, &(&1.thread == :ticket and &1.lifecycle == :live))

      assert {:ok, public_usages} = CMS.Assets.usages(community, asset.id, nil)
      assert Enum.any?(public_usages, &(&1.thread == :ticket and &1.lifecycle == :live))

      assert {:ok, published} = CMS.Tickets.get_internal(community, ticket.id, ticket_actor)

      assert {:ok, _draft} =
               CMS.Tickets.ensure_draft(
                 community,
                 ticket.id,
                 published.lifecycle_version,
                 ticket_actor,
                 Ecto.UUID.generate()
               )

      assert {:ok, usages} = CMS.Assets.usages(community, asset.id, ticket_actor)
      ticket_usages = Enum.filter(usages, &(&1.thread == :ticket))
      assert Enum.frequencies_by(ticket_usages, & &1.lifecycle) == %{draft: 1, live: 1}

      assert {:error, _reason} =
               CMS.Assets.Refs.copy_refs(post, ticket_article)

      assert {:error, _reason} =
               CMS.Assets.delete(community, asset.id, user, Ecto.UUID.generate())

      assert Repo.get_by!(ArticleLifecycle, article_id: ticket.id, thread: :ticket).state ==
               :published
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

    test "promotes a finalized application logo into a community asset", ~m(community user)a do
      upload = %CommunityApplicationLogoUpload{
        public_ref: "upload_" <> Ecto.UUID.generate(),
        url: "https://cdn.example/logo.png",
        storage: "r2",
        storage_key: "applications/logo.png",
        content_hash: "sha256:logo",
        filename: "logo.png",
        mime_type: "image/png",
        size_bytes: 128,
        status: :finalized
      }

      assert {:ok, asset} = CMS.Assets.register_from_application_upload(community, upload, user)
      assert asset.asset_type == :image
      assert asset.meta["applicationUploadRef"] == upload.public_ref
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

    test "replays register and archive/restore results for the same command identity",
         ~m(community user)a do
      register_command_id = Ecto.UUID.generate()
      attrs = image_asset_attrs("replay.png", 128)

      assert {:ok, first} =
               CMS.Assets.register_to_community(community, attrs, user, register_command_id)

      assert {:ok, replayed} =
               CMS.Assets.register_to_community(community, attrs, user, register_command_id)

      assert replayed.id == first.id
      assert replayed.command_id == register_command_id

      archive_command_id = Ecto.UUID.generate()

      assert {:ok, archived} =
               CMS.Assets.archive(community, first.id, user, archive_command_id)

      assert {:ok, archived_replay} =
               CMS.Assets.archive(community, first.id, user, archive_command_id)

      assert archived_replay.id == archived.id
      assert archived_replay.status == :archived
      assert archived_replay.command_id == archive_command_id

      restore_command_id = Ecto.UUID.generate()

      assert {:ok, restored} =
               CMS.Assets.restore(community, first.id, user, restore_command_id)

      assert {:ok, restored_replay} =
               CMS.Assets.restore(community, first.id, user, restore_command_id)

      assert restored_replay.id == restored.id
      assert restored_replay.status == :active
      assert restored_replay.command_id == restore_command_id
    end

    test "Assets.Effects records provider-delete intent in the caller transaction",
         ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("effects.png", 64)
          |> Map.merge(%{storage: "r2", storage_key: "effects/original"}),
          user,
          Ecto.UUID.generate()
        )

      command_id = Ecto.UUID.generate()

      assert {:ok, {:ok, %CMS.Outbox.Event{identity_type: :command} = event}} =
               Repo.transaction(fn ->
                 CMS.Assets.Effects.enqueue_provider_delete(asset, {:command, command_id})
               end)

      assert event.event == "asset.provider_delete"
      assert event.resource_id == to_string(asset.id)
      assert event.command_id == command_id
      assert event.effect_key == "asset:#{asset.id}"
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

    test "draft usage visibility is one page query without mutation locks",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("usage-query.png", 100),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: asset.id, block_id: "usage-query"}]},
                 community: community
               )

      {result, queries} = capture_queries(fn -> CMS.Assets.usages(community, asset.id, user) end)

      assert {:ok, [%{lifecycle: :draft}]} = result
      assert Enum.count(queries, &String.contains?(&1, "article_asset_refs")) == 1
      refute Enum.any?(queries, &String.contains?(&1, "pg_advisory_xact_lock"))
    end

    test "returns trashed draft refs as trashed without opening per-ref locks",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("trashed-draft.png", 100),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: asset.id, block_id: "trashed-draft"}]},
                 community: community
               )

      assert {:ok, _trash} =
               CMS.Articles.Trash.trash(post, user, community: community)

      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
      |> Repo.delete!()

      assert {:ok, [%{lifecycle: :trashed}]} =
               CMS.Assets.usages(community, asset.id, user)
    end

    test "fails closed when the draft article has no target community binding",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("missing-binding.png", 100),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: asset.id, block_id: "missing-binding"}]},
                 community: community
               )

      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
      |> Repo.delete!()

      assert {:ok, []} = CMS.Assets.usages(community, asset.id, user)
    end

    test "keeps non-draft refs classified when their target binding is missing",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("non-draft-missing-binding.png", 100),
          user,
          Ecto.UUID.generate()
        )

      public = Repo.get_by!(ArticlePublic, article_id: post.id)
      revision = Repo.get!(ArticleRevision, public.revision_id)

      historical_revision =
        %ArticleRevision{}
        |> ArticleRevision.changeset(%{
          article_id: post.id,
          body_snapshot_id: revision.body_snapshot_id,
          title: revision.title,
          digest: revision.digest,
          slug: revision.slug,
          content_hash: revision.content_hash,
          schema_version: revision.schema_version,
          cleanup_after: revision.cleanup_after
        })
        |> Repo.insert!()

      {_, trashed_post, _, _} = mock_article(:post, community, user)
      trashed_public = Repo.get_by!(ArticlePublic, article_id: trashed_post.id)

      for revision_id <- [public.revision_id, historical_revision.id, trashed_public.revision_id] do
        %ArticleAssetRef{}
        |> ArticleAssetRef.changeset(%{
          community_id: community.id,
          asset_id: asset.id,
          revision_id: revision_id,
          usage: :inline
        })
        |> Repo.insert!()
      end

      assert {:ok, _trash} =
               CMS.Articles.Trash.trash(trashed_post, user, community: community)

      Repo.delete_all(
        from(binding in ArticleBinding, where: binding.community_id == ^community.id)
      )

      assert {:ok, usages} = CMS.Assets.usages(community, asset.id, user)
      assert Enum.frequencies_by(usages, & &1.lifecycle) == %{live: 1, historical: 1, trashed: 1}
    end

    test "keeps replacement planning bounded for 101 draft refs",
         ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("many-usage-refs.png", 100),
          user,
          Ecto.UUID.generate()
        )

      {:ok, replacement_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("many-usage-replacement.png", 100),
          user,
          Ecto.UUID.generate()
        )

      for index <- 1..101 do
        {_, article, _, _} = mock_article(:post, community, user)
        assert {:ok, _draft} = open_draft(article, user)

        assert {:ok, %{body: [_]}} =
                 CMS.Assets.link_refs(
                   article,
                   %{asset_refs: [%{asset_id: asset.id, block_id: "many-#{index}"}]},
                   community: community
                 )
      end

      {result, queries} = capture_queries(fn -> CMS.Assets.usages(community, asset.id, user) end)

      assert {:ok, usages} = result
      assert length(usages) == 101
      refute Enum.any?(usages, &Map.has_key?(&1, :resource_lifecycle))
      refute Enum.any?(usages, &Map.has_key?(&1, :community_lifecycle))
      assert Enum.count(queries, &String.contains?(&1, "article_asset_refs")) == 2
      refute Enum.any?(queries, &String.contains?(&1, "pg_advisory_xact_lock"))

      {plan_result, plan_queries} =
        capture_queries(fn ->
          CMS.Assets.create_replacement_plan(
            community,
            %{from_asset_id: asset.id, to_asset_id: replacement_asset.id},
            user
          )
        end)

      assert {:ok, %AssetReplacementPlan{items: items}} = plan_result
      assert length(items) == 101
      assert Enum.all?(items, &((&1[:decision] || &1["decision"]) == "editable"))
      assert Enum.count(plan_queries, &String.contains?(&1, "article_asset_refs")) == 2
      assert Enum.count(plan_queries, &String.contains?(&1, ~s("cms"."ticket_states"))) <= 2

      refute Enum.any?(plan_queries, &String.contains?(&1, "pg_advisory_xact_lock"))
    end

    test "includes branch-owned DocDraft asset refs in the batch usage query" do
      {doc_community, doc, _attrs, doc_user} = mock_article(:doc)
      doc_article = Repo.get!(Article, doc.id)
      doc_author = Repo.get_by!(Author, user_id: doc_user.id)

      assert {:ok, _version} =
               CMS.Docs.Editor.ensure_editable_draft(doc_article, doc.branch_id, doc_author, 1)

      {:ok, asset} =
        CMS.Assets.register_to_community(
          doc_community,
          image_asset_attrs("doc-usage-query.png", 100),
          doc_user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 doc,
                 %{asset_refs: [%{asset_id: asset.id, block_id: "doc-usage-query"}]},
                 community: doc_community
               )

      assert {:ok, [%{lifecycle: :draft, thread: :doc}]} =
               CMS.Assets.usages(doc_community, asset.id, doc_user)

      {:ok, replacement_asset} =
        CMS.Assets.register_to_community(
          doc_community,
          image_asset_attrs("doc-usage-replacement.png", 100),
          doc_user,
          Ecto.UUID.generate()
        )

      assert {:ok, %AssetReplacementPlan{items: [item]}} =
               CMS.Assets.create_replacement_plan(
                 doc_community,
                 %{from_asset_id: asset.id, to_asset_id: replacement_asset.id},
                 doc_user
               )

      assert (item[:decision] || item["decision"]) == "unsupported"

      doc_state = Repo.get_by!(DocBranchState, article_id: doc.id, branch_id: doc.branch_id)
      Repo.delete!(doc_state)

      assert {:ok, []} = CMS.Assets.usages(doc_community, asset.id, doc_user)
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
               CMS.Assets.replace_use_workflow(
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
                 workflow_ref
               )

      assert version == draft.version + 1
      assert [%ArticleAssetRef{asset_id: asset_id}] = article_refs(:post, post.id)
      assert asset_id == to_asset.id

      assert {:ok, %{draft_version: ^version, workflow_ref: ^workflow_ref}} =
               CMS.Assets.replace_use_workflow(
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
                 workflow_ref
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

      persisted = Repo.get!(AssetReplacementPlan, applied.id)
      [persisted_item] = persisted.items
      persisted_result = persisted_item[:result] || persisted_item["result"]
      assert (persisted_result[:status] || persisted_result["status"]) in [:applied, "applied"]

      assert {:ok, %AssetReplacementPlan{status: :completed, apply_run_ref: ^run_ref}} =
               CMS.Assets.apply_replacement_plan(applied, user, body_bags: %{post.id => body_bag})
    end

    test "keeps a subset apply run pending until every article is selected",
         ~m(community post user)a do
      {_community, other_post, _attrs, _other_user} = mock_article(:post, community, user)
      assert {:ok, _draft} = open_draft(other_post, user)

      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("subset-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("subset-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "subset-one"}]},
                 community: community
               )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 other_post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "subset-two"}]},
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{} = plan} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      post_body_bag = body_bag_for(post)
      other_body_bag = body_bag_for(other_post)

      assert {:ok, %AssetReplacementPlan{status: :completed} = partial} =
               CMS.Assets.apply_replacement_plan(
                 plan,
                 user,
                 article_ids: [post.id],
                 body_bags: %{post.id => post_body_bag}
               )

      run = Repo.get_by!(AssetWorkflowRun, workflow_ref: partial.apply_run_ref)
      assert run.status == :pending

      step_statuses = Repo.all(AssetWorkflowStep) |> Enum.map(& &1.status)
      assert Enum.count(step_statuses, &(&1 == :succeeded)) == 1
      assert Enum.count(step_statuses, &(&1 == :pending)) == 1

      assert {:ok, %AssetReplacementPlan{status: :completed}} =
               CMS.Assets.apply_replacement_plan(
                 partial,
                 user,
                 article_ids: [other_post.id],
                 body_bags: %{other_post.id => other_body_bag}
               )

      assert Repo.get_by!(AssetWorkflowRun, workflow_ref: partial.apply_run_ref).status ==
               :completed
    end

    test "skips historical-only plan items without creating a draft",
         ~m(community user)a do
      {_community, historical_post, _attrs, _other_user} = mock_article(:post, community, user)

      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("historical-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("historical-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      step_ref = "historical-only-step"

      {:ok, plan} =
        %AssetReplacementPlan{}
        |> AssetReplacementPlan.changeset(%{
          community_id: community.id,
          from_asset_id: from_asset.id,
          to_asset_id: to_asset.id,
          created_by_id: user.id,
          status: :pending,
          items: [
            %{
              article_id: historical_post.id,
              decision: "historical_only",
              observed_live_revision_id: nil,
              observed_draft_version: nil,
              usage_locators: [%{step_ref: step_ref, usage: "inline", block_id: "historical"}],
              result: nil
            }
          ]
        })
        |> Repo.insert()

      assert Repo.get_by(ArticleDraft, article_id: historical_post.id) == nil

      assert {:ok, %AssetReplacementPlan{status: :completed} = applied} =
               CMS.Assets.apply_replacement_plan(plan, user, article_ids: [historical_post.id])

      [item] = applied.items
      result = item[:result] || item["result"]
      value = result[:value] || result["value"]
      assert (result[:status] || result["status"]) in [:skipped, "skipped"]
      assert (value[:reason] || value["reason"]) == "historical_only"

      assert [%AssetWorkflowStep{status: :skipped, result: %{"reason" => "plan_decision"}}] =
               Repo.all(AssetWorkflowStep)

      assert Repo.get_by(ArticleDraft, article_id: historical_post.id) == nil
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

      {:ok, paged_refs} =
        CMS.Assets.refs(community, asset.id, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})

      assert length(paged_refs.entries) == 20
      assert paged_refs.total_count == 105
      assert paged_refs.total_pages == 6
      assert paged_refs.page == 1

      {:ok, second_page_refs} =
        CMS.Assets.refs(community, asset.id, %GroupherServer.Pagi.Params.Offset{page: 2, size: 20})

      assert length(second_page_refs.entries) == 20
      assert second_page_refs.total_count == 105
      assert second_page_refs.total_pages == 6
      assert second_page_refs.page == 2

      first_page_ids = paged_refs.entries |> Enum.map(& &1.id) |> MapSet.new()
      second_page_ids = second_page_refs.entries |> Enum.map(& &1.id) |> MapSet.new()

      assert MapSet.disjoint?(first_page_ids, second_page_ids)

      {result, queries} =
        capture_queries(fn -> CMS.Assets.refs(community, asset.id, %{cursor: %{first: 20}}) end)

      assert {:ok, %{entries: first_cursor_entries, end_cursor: cursor}} = result
      assert Enum.map(first_cursor_entries, & &1.id) == Enum.map(paged_refs.entries, & &1.id)
      refute Enum.any?(queries, &String.contains?(String.downcase(&1), "count("))

      assert {:ok, %{entries: next_entries}} =
               CMS.Assets.refs(community, asset.id, %{cursor: %{first: 20, after: cursor}})

      assert Enum.map(next_entries, & &1.id) == Enum.map(second_page_refs.entries, & &1.id)

      {:ok, other_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("other-refs.png", 70),
          user,
          Ecto.UUID.generate()
        )

      assert {:error, _} =
               CMS.Assets.refs(community, other_asset.id, %{cursor: %{first: 20, after: cursor}})
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
      {:ok, intent} =
        CMS.Assets.create_upload_intent(
          community,
          image_asset_attrs("quota-complete-next.png", 1),
          user
        )

      [encoded_payload, _signature] = String.split(intent.capability, ".")

      capability_payload =
        encoded_payload |> Base.url_decode64!(padding: false) |> Jason.decode!()

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
                 upload_ref: intent.upload_ref,
                 idempotency_key: intent.upload_ref,
                 asset_public_ref: intent.asset_public_ref,
                 community_id: community.id,
                 content_hash: "sha256:quota-complete",
                 filename: "quota-complete-next.png",
                 mime_type: "image/png",
                 asset_type: :image,
                 size_bytes: 1,
                 storage: "r2",
                 storage_key: intent.object_key,
                 url: capability_payload["canonicalUrl"],
                 uploader_id: user.id
               })
    end

    test "persists upload completion and replays duplicate callbacks",
         ~m(community user)a do
      {:ok, intent} =
        CMS.Assets.create_upload_intent(
          community,
          image_asset_attrs("durable-completion.png", 80),
          user
        )

      completion = upload_completion_input(intent, community, user)

      assert {:ok, %CommunityAsset{} = asset} = CMS.Assets.complete_upload(completion)
      assert {:ok, %CommunityAsset{} = replayed} = CMS.Assets.complete_upload(completion)
      assert replayed.id == asset.id
      assert Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref).state == :completed
      assert Repo.aggregate(CommunityAsset, :count, :id) == 1
    end

    test "rejects completion facts that are not bound to the upload intent",
         ~m(community user)a do
      {:ok, intent} =
        CMS.Assets.create_upload_intent(
          community,
          image_asset_attrs("bound-facts.png", 80),
          user
        )

      assert {:error, %ErrorCat.Error{details: "storage key does not match upload intent"}} =
               CMS.Assets.complete_upload(
                 upload_completion_input(intent, community, user)
                 |> Map.put(:storage_key, "other/object")
               )

      assert Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref).state == :failed
      assert Repo.aggregate(CommunityAsset, :count, :id) == 0
    end

    test "records an expired upload intent when completion arrives after its lease",
         ~m(community user)a do
      {:ok, intent} =
        CMS.Assets.create_upload_intent(
          community,
          image_asset_attrs("expired-upload.png", 80),
          user
        )

      intent_record = Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref)

      _expired_record =
        intent_record
        |> AssetUpload.changeset(%{
          capability_expires_at: DateTime.add(DateTime.utc_now(:second), -1, :second)
        })
        |> Repo.update!()

      assert {:error, %ErrorCat.Error{details: "asset upload intent expired"}} =
               CMS.Assets.complete_upload(upload_completion_input(intent, community, user))

      assert Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref).state == :expired
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

      assert {:ok, %{entries: entries}} =
               CMS.Assets.page(community, %{}, %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20
               })

      refute Enum.any?(entries, &(&1.id == asset.id))

      assert {:ok, restored} =
               CMS.Assets.restore(community, asset.id, user, Ecto.UUID.generate())

      assert restored.status == :active

      assert {:ok, %{entries: entries}} =
               CMS.Assets.page(community, %{}, %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20
               })

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

    test "provider reconciliation records a durable run and outbox step",
         ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("provider-repair.png", 80)
          |> Map.merge(%{storage: "r2", storage_key: "repair/original"}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)
      assert {:ok, _deleted} = CMS.Assets.Persist.delete(community, asset.id)

      workflow_ref = "provider-reconciliation:test:#{community.id}"

      assert {:ok, %{run_ref: ^workflow_ref, status: :completed, enqueued: 1, skipped: 0}} =
               CMS.Assets.ProviderReconciliation.enqueue_missing(
                 community,
                 workflow_ref: workflow_ref,
                 age_seconds: 0
               )

      assert Repo.get_by!(AssetWorkflowRun, workflow_ref: workflow_ref).status == :completed

      assert [%AssetWorkflowStep{status: :succeeded, result: %{"outbox" => "created"}}] =
               Repo.all(AssetWorkflowStep)

      assert Repo.get_by!(CMS.Outbox.Event,
               event: "asset.provider_delete",
               resource_id: to_string(asset.id)
             ).identity_type == :workflow
    end

    test "handled workflow failures release the run lease",
         ~m(community)a do
      workflow_ref = "provider-reconciliation:failure:#{community.id}"

      assert {:ok, run} =
               CMS.Assets.Workflow.ensure_run(%{
                 workflow_ref: workflow_ref,
                 workflow_type: "provider_reconciliation",
                 community_id: community.id,
                 resource_type: "community",
                 resource_id: to_string(community.id),
                 status: :pending
               })

      owner = "provider-reconciliation:test:#{community.id}"
      assert {:ok, running} = CMS.Assets.Workflow.claim_run(run, owner)
      assert running.status == :running
      assert {:ok, failed} = CMS.Assets.Workflow.fail_run(running, owner, :provider_unavailable)
      assert failed.status == :failed
      assert failed.locked_by == nil
      assert failed.lease_expires_at == nil
      assert failed.last_error == ":provider_unavailable"
    end

    test "generated cleanup keeps partial success and durable step results",
         ~m(community post user)a do
      {:ok, referenced} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("generated-referenced.png", 80)
          |> Map.put(:public_ref, "asset_generated_referenced"),
          user,
          Ecto.UUID.generate()
        )

      {:ok, unreferenced} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("generated-unreferenced.png", 90)
          |> Map.put(:public_ref, "asset_generated_unreferenced"),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{cur_user: user, asset_refs: [%{asset_id: referenced.id}]},
                 community: community
               )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)
      workflow_ref = "generated-cleanup:test:#{community.id}"

      assert {:error, %ErrorCat.Error{details: "asset is still referenced"}} =
               CMS.Assets.delete_generated_assets(
                 community,
                 [referenced.public_ref, unreferenced.public_ref],
                 workflow_ref: workflow_ref
               )

      assert Repo.get!(CommunityAsset, referenced.id).status == :active
      assert Repo.get!(CommunityAsset, unreferenced.id).status == :deleted
      assert Repo.get_by!(AssetWorkflowRun, workflow_ref: workflow_ref).status == :failed

      assert Repo.all(AssetWorkflowStep) |> Enum.count(&(&1.status == :succeeded)) == 1
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

    test "keeps the current Draft version when the newest usage row belongs to a Revision",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("mixed-plan-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("mixed-plan-b.png", 20),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               CMS.Assets.link_refs(
                 post,
                 %{asset_refs: [%{asset_id: from_asset.id, block_id: "mixed-draft"}]},
                 community: community
               )

      public = Repo.get_by!(ArticlePublic, article_id: post.id)

      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: from_asset.id,
        revision_id: public.revision_id,
        usage: :inline,
        block_id: "mixed-live"
      })
      |> Ecto.Changeset.put_change(
        :inserted_at,
        DateTime.add(DateTime.utc_now(:second), 5, :second)
      )
      |> Repo.insert!()

      assert {:ok, %AssetReplacementPlan{items: [item]}} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert (item[:observed_draft_version] || item["observed_draft_version"]) == 1
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

  defp upload_completion_input(intent, community, user) do
    [encoded_payload, _signature] = String.split(intent.capability, ".")
    payload = encoded_payload |> Base.url_decode64!(padding: false) |> Jason.decode!()

    %{
      upload_ref: intent.upload_ref,
      idempotency_key: intent.upload_ref,
      asset_public_ref: intent.asset_public_ref,
      community_id: community.id,
      content_hash: "sha256:durable-completion",
      filename: "durable-completion.png",
      mime_type: "image/png",
      asset_type: :image,
      size_bytes: 80,
      storage: "r2",
      storage_key: intent.object_key,
      url: payload["canonicalUrl"],
      thread: :post,
      uploader_id: user.id
    }
  end

  defp open_draft(article_view, user) do
    article = Repo.get!(Article, article_view.article_id)
    author = Repo.get_by!(Author, user_id: user.id)
    CMS.Articles.Draft.Store.ensure_from_public(article, author)
  end

  defp body_bag_for(article_view) do
    draft = Repo.get_by!(ArticleDraft, article_id: article_view.id)
    body = Repo.get!(ArticleBodyDraft, draft.body_draft_id)
    BodyBag.from_document(body) |> elem(1)
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

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end
end
