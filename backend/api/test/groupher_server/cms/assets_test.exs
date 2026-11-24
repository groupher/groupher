defmodule GroupherServer.Test.CMS.AssetsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Assets.ThreadIdentity
  alias CMS.Hash

  @publish_throttle CMS.Gate.RateLimit.Publish.Config.publish_throttle()
  @throttle_interval @publish_throttle.interval_minutes
  @throttle_hour_limit @publish_throttle.hour_limit
  @throttle_day_limit @publish_throttle.day_limit

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    AssetUpload,
    AssetReplacementPlan,
    AssetWorkflowRun,
    AssetWorkflowStep,
    CommunityAdmin,
    CommunityAsset,
    CommunityApplicationLogoUpload
  }

  defmodule ProviderDeleteEndpoint do
    @moduledoc false

    import Plug.Conn

    def init(opts), do: opts

    def call(conn, _opts) do
      {:ok, body, conn} = read_body(conn)
      status = Application.fetch_env!(:groupher_server, :asset_provider_test_status)
      pid = Application.fetch_env!(:groupher_server, :asset_provider_test_pid)

      send(pid, {
        :asset_provider_delete_request,
        status,
        conn.request_path,
        get_req_header(conn, "authorization"),
        Jason.decode!(body)
      })

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(status, ~s({"accepted":true}))
    end
  end

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
        snapshot_id: public.snapshot_id,
        usage: :inline,
        block_id: "ticket-source-ref"
      })
      |> Repo.insert!()

      ticket_actor = grant_ticket_actions(community, user)

      assert {:ok, ticket} =
               CMS.Tickets.create_from_post(
                 community,
                 post.id,
                 %{title: "Ticket with inherited asset"},
                 ticket_actor,
                 Ecto.UUID.generate()
               )

      ticket_working_copy =
        Repo.get_by!(ArticleWorkingCopy, article_id: ticket.id, scope_type: :default)

      assert [%ArticleAssetRef{asset_id: asset_id}] =
               Repo.all(
                 from(ref in ArticleAssetRef,
                   where: ref.working_copy_id == ^ticket_working_copy.id
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
                 internal.working_copy_revision,
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

      refute function_exported?(CMS.Assets.Refs, :copy_refs, 2)

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

      operation_ref = Ecto.UUID.generate()

      assert {:ok, {:ok, %CMS.Outbox.Event{} = event}} =
               Repo.transaction(fn ->
                 CMS.Assets.Effects.enqueue_provider_delete(asset, operation_ref)
               end)

      assert event.event == "asset.provider_delete"
      assert event.resource_id == to_string(asset.id)
      assert event.operation_ref == operation_ref

      assert event.dedupe_key ==
               CMS.Outbox.DedupeKey.encode([asset.public_ref, asset.storage, asset.storage_key])
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

    test "does not change a storage owner's public identity on duplicate registration",
         ~m(community user)a do
      storage_key = "identity-owner/#{Ecto.UUID.generate()}/original"

      attrs =
        image_asset_attrs("identity-owner.png", 64)
        |> Map.merge(%{
          public_ref: "asset_identity_owner",
          storage: "r2",
          storage_key: storage_key
        })

      assert {:ok, owner} =
               CMS.Assets.register_to_community(community, attrs, user, Ecto.UUID.generate())

      owner_before_conflict = Repo.get!(CommunityAsset, owner.id)

      assert {:error, %{reason: :storage_identity_conflict}} =
               CMS.Assets.register_to_community(
                 community,
                 Map.put(attrs, :public_ref, "asset_identity_reassigned"),
                 user,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(CommunityAsset, owner.id) == owner_before_conflict
    end

    test "a deleted provider object identity cannot be registered again",
         ~m(community user)a do
      storage_key = "deleted-owner/#{Ecto.UUID.generate()}/original"

      {:ok, owner} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("deleted-owner.png", 64)
          |> Map.merge(%{storage: "r2", storage_key: storage_key}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)

      assert {:ok, %{status: :deleted, deleted_at: deleted_at}} =
               CMS.Assets.delete(community, owner.id, user, Ecto.UUID.generate())

      assert not is_nil(deleted_at)
      owner_after_delete = Repo.get!(CommunityAsset, owner.id)

      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :asset},
                reason: :storage_identity_conflict
              }} =
               CMS.Assets.register_to_community(
                 community,
                 image_asset_attrs("deleted-owner-replacement.png", 96)
                 |> Map.merge(%{storage: "r2", storage_key: storage_key}),
                 user,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(CommunityAsset, owner.id) == owner_after_delete

      assert Repo.aggregate(
               from(asset in CommunityAsset,
                 where: asset.storage == "r2" and asset.storage_key == ^storage_key
               ),
               :count,
               :id
             ) == 1
    end

    test "provider object identity cannot move to another community",
         ~m(community user)a do
      {:ok, other_community} = mock_community(user)
      storage_key = "cross-community/#{Ecto.UUID.generate()}/original"

      {:ok, owner} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("cross-community-owner.png", 64)
          |> Map.merge(%{storage: "r2", storage_key: storage_key}),
          user,
          Ecto.UUID.generate()
        )

      owner_before_conflict = Repo.get!(CommunityAsset, owner.id)

      assert {:error,
              %ErrorCat.Error{
                namespace: {:cms, :asset},
                reason: :storage_identity_conflict
              }} =
               CMS.Assets.register_to_community(
                 other_community,
                 image_asset_attrs("cross-community-replacement.png", 96)
                 |> Map.merge(%{storage: "r2", storage_key: storage_key}),
                 user,
                 Ecto.UUID.generate()
               )

      assert Repo.get!(CommunityAsset, owner.id) == owner_before_conflict

      assert Repo.aggregate(
               from(asset in CommunityAsset,
                 where: asset.storage == "r2" and asset.storage_key == ^storage_key
               ),
               :count,
               :id
             ) == 1
    end

    test "the storage identity unique constraint rejects direct inserts for deleted owners",
         ~m(community user)a do
      {:ok, other_community} = mock_community(user)
      storage_key = "deleted-constraint/#{Ecto.UUID.generate()}/original"

      {:ok, owner} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("deleted-constraint-owner.png", 64)
          |> Map.merge(%{storage: "r2", storage_key: storage_key}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)

      assert {:ok, %{status: :deleted}} =
               CMS.Assets.delete(community, owner.id, user, Ecto.UUID.generate())

      owner_after_delete = Repo.get!(CommunityAsset, owner.id)

      changeset =
        %CommunityAsset{}
        |> CommunityAsset.changeset(
          image_asset_attrs("deleted-constraint-duplicate.png", 96)
          |> Map.merge(%{
            community_id: other_community.id,
            uploader_id: user.id,
            storage: "r2",
            storage_key: storage_key
          })
        )

      assert {:error, %Ecto.Changeset{} = changeset} = Repo.insert(changeset)

      assert Enum.any?(changeset.errors, fn {_field, {_message, opts}} ->
               opts[:constraint_name] == "community_assets_storage_key_index"
             end)

      assert Repo.get!(CommunityAsset, owner.id) == owner_after_delete

      assert Repo.aggregate(
               from(asset in CommunityAsset,
                 where: asset.storage == "r2" and asset.storage_key == ^storage_key
               ),
               :count,
               :id
             ) == 1
    end

    test "retired ref linking entry points are not exported" do
      refute function_exported?(CMS.Assets, :link_refs, 3)
      refute function_exported?(CMS.Assets, :copy_refs, 2)
    end

    test "links Article attachment and cover refs without changing storage ownership",
         ~m(community post user)a do
      body_asset = image_asset_attrs("body.png", 100)
      cover_asset = image_asset_attrs("cover.png", 200)

      assert {:ok, %{body: [_], cover: [_]}} =
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{
                       asset: body_asset,
                       usage: :attachment,
                       title: "document attachment",
                       alt: "body attachment"
                     }
                   ],
                   cover_asset: cover_asset
                 },
                 community: community
               )

      refs = article_refs(:post, post.id)
      working_copy_refs = Enum.filter(refs, &(not is_nil(&1.working_copy_id)))
      snapshot_refs = Enum.filter(refs, &(not is_nil(&1.snapshot_id)))
      assert Enum.map(working_copy_refs, & &1.usage) |> Enum.sort() == [:attachment, :cover]
      assert Enum.map(snapshot_refs, & &1.usage) |> Enum.sort() == [:attachment, :cover]
      [body_ref] = Enum.filter(working_copy_refs, &(&1.usage == :attachment))
      assert body_ref.usage == :attachment
      assert body_ref.title == "document attachment"
      assert body_ref.alt == "body attachment"

      {:ok, summary} = CMS.Assets.usage_summary(community, body_ref.asset_id, user)
      assert summary.draft == 1
      assert summary.live == 0
      assert summary.historical == 1
      assert summary.trashed == 0

      historical_ref_ids = Enum.map(snapshot_refs, & &1.id)

      {:ok, usage} = CMS.Assets.usage(community)
      assert usage.asset_count == 2
      assert usage.storage_bytes == 300

      assert {:ok, %{body: [], cover: [_]}} =
               test_link_refs(
                 post,
                 %{
                   asset_refs: [],
                   cover_edit_info: nil
                 },
                 community: community
               )

      refs_after_second_save = article_refs(:post, post.id)

      working_copy_refs_after_second_save =
        Enum.filter(refs_after_second_save, &(not is_nil(&1.working_copy_id)))

      assert [%ArticleAssetRef{usage: :cover}] = working_copy_refs_after_second_save
      assert Enum.all?(historical_ref_ids, &Repo.get(ArticleAssetRef, &1))

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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset.id, block_id: "usage-query"}
                   ]
                 },
                 community: community
               )

      {result, queries} = capture_queries(fn -> CMS.Assets.usages(community, asset.id, user) end)

      assert {:ok, usages} = result
      assert Enum.frequencies_by(usages, & &1.lifecycle) == %{draft: 1, historical: 1}
      assert Enum.count(queries, &String.contains?(&1, "article_asset_refs")) == 1
      refute Enum.any?(queries, &String.contains?(&1, "pg_advisory_xact_lock"))
    end

    test "fails closed for trashed draft refs when the target binding is missing",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("trashed-draft.png", 100),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset.id, block_id: "trashed-draft"}
                   ]
                 },
                 community: community
               )

      assert {:ok, _trash} =
               CMS.Articles.Trash.trash(post, user,
                 community: community,
                 operation_ref: Ecto.UUID.generate()
               )

      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
      |> Repo.delete!()

      assert {:ok, []} = CMS.Assets.usages(community, asset.id, user)
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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset.id, block_id: "missing-binding"}
                   ]
                 },
                 community: community
               )

      Repo.get_by!(ArticleBinding, article_id: post.id, community_id: community.id)
      |> Repo.delete!()

      assert {:ok, []} = CMS.Assets.usages(community, asset.id, user)
    end

    test "fails closed for non-draft refs when the target binding is missing",
         ~m(community post user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("non-draft-missing-binding.png", 100),
          user,
          Ecto.UUID.generate()
        )

      public = Repo.get_by!(ArticlePublic, article_id: post.id)
      snapshot = Repo.get!(ArticleSnapshot, public.snapshot_id)

      historical_snapshot =
        snapshot
        |> Map.from_struct()
        |> Map.take([
          :article_id,
          :source_working_copy_id,
          :source_revision,
          :title,
          :digest,
          :slug,
          :capture_actor_type,
          :captured_by_id,
          :captured_at,
          :causation_command_id
        ])
        |> Map.put(
          :body,
          Map.merge(CMS.Articles.Body.document(snapshot), %{
            article_id: snapshot.article_id,
            type: :snapshot
          })
        )
        |> Map.update!(:source_revision, &(&1 + 1))
        |> Map.put(:captured_at, DateTime.add(snapshot.captured_at, -1, :second))
        |> Map.put(:causation_command_id, Ecto.UUID.generate())
        |> then(&ArticleSnapshot.changeset(%ArticleSnapshot{}, &1))
        |> Repo.insert!()

      {_, trashed_post, _, _} = mock_article_after_throttle(:post, community, user)
      trashed_public = Repo.get_by!(ArticlePublic, article_id: trashed_post.id)

      for snapshot_id <- [public.snapshot_id, historical_snapshot.id, trashed_public.snapshot_id] do
        %ArticleAssetRef{}
        |> ArticleAssetRef.changeset(%{
          community_id: community.id,
          asset_id: asset.id,
          snapshot_id: snapshot_id,
          usage: :inline
        })
        |> Repo.insert!()
      end

      assert {:ok, _trash} =
               CMS.Articles.Trash.trash(trashed_post, user,
                 community: community,
                 operation_ref: Ecto.UUID.generate()
               )

      Repo.delete_all(
        from(binding in ArticleBinding, where: binding.community_id == ^community.id)
      )

      assert {:ok, []} = CMS.Assets.usages(community, asset.id, user)
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
        {_, article, _, _} =
          mock_article_in_next_publish_window(:post, community, user, index)

        assert {:ok, _draft} = open_draft(article, user)

        assert {:ok, %{body: [_]}} =
                 test_link_refs(
                   article,
                   %{
                     asset_refs: [
                       %{usage: :attachment, asset_id: asset.id, block_id: "many-#{index}"}
                     ]
                   },
                   community: community
                 )
      end

      {result, queries} = capture_queries(fn -> CMS.Assets.usages(community, asset.id, user) end)

      assert {:ok, usages} = result
      assert length(usages) == 202
      assert Enum.frequencies_by(usages, & &1.lifecycle) == %{draft: 101, historical: 101}
      refute Enum.any?(usages, &Map.has_key?(&1, :resource_lifecycle))
      refute Enum.any?(usages, &Map.has_key?(&1, :community_lifecycle))
      assert Enum.count(queries, &String.contains?(&1, "article_asset_refs")) == 3
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
      assert length(items) == 202
      assert Enum.count(items, &((&1[:decision] || &1["decision"]) == "editable")) == 101
      assert Enum.count(items, &((&1[:decision] || &1["decision"]) == "historical_only")) == 101
      assert Enum.count(plan_queries, &String.contains?(&1, "article_asset_refs")) == 3
      assert Enum.count(plan_queries, &String.contains?(&1, ~s("cms"."ticket_states"))) <= 3

      refute Enum.any?(plan_queries, &String.contains?(&1, "pg_advisory_xact_lock"))
    end

    test "includes Doc WorkingCopy asset refs in the batch usage query" do
      {doc_community, doc, _attrs, doc_user} = mock_article(:doc)
      public = Repo.get!(ArticlePublic, doc.id)
      actor = doc_user
      {:ok, doc_lord} = db_insert(:user)

      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          community_id: doc_community.id,
          user_id: doc_lord.id,
          is_lord: true
        })
      )

      assert {:ok, _} =
               CMS.DocTree.Commands.BeginEdit.execute(
                 doc_community,
                 doc.id,
                 public.snapshot_id,
                 actor,
                 Ecto.UUID.generate()
               )

      {:ok, asset} =
        CMS.Assets.register_to_community(
          doc_community,
          image_asset_attrs("doc-usage-query.png", 100),
          doc_user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               test_link_refs(
                 doc,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset.id, block_id: "doc-usage-query"}
                   ]
                 },
                 community: doc_community
               )

      assert {:ok, usages} = CMS.Assets.usages(doc_community, asset.id, doc_user)
      assert Enum.frequencies_by(usages, & &1.lifecycle) == %{draft: 1, historical: 1}
      assert Enum.all?(usages, &(&1.thread == :doc))

      {:ok, replacement_asset} =
        CMS.Assets.register_to_community(
          doc_community,
          image_asset_attrs("doc-usage-replacement.png", 100),
          doc_user,
          Ecto.UUID.generate()
        )

      assert {:ok, %AssetReplacementPlan{items: items}} =
               CMS.Assets.create_replacement_plan(
                 doc_community,
                 %{from_asset_id: asset.id, to_asset_id: replacement_asset.id},
                 doc_user
               )

      assert length(items) == 2

      assert Enum.all?(items, &((&1[:decision] || &1["decision"]) == "unsupported"))

      assert {:ok, _} = CMS.Seeds.Docs.delete(doc_community, doc.id, doc_lord)
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
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset_a.id, block_id: "asset-a"},
                     %{usage: :attachment, asset_id: asset_b.id, block_id: "asset-b"}
                   ]
                 },
                 community: community
               )

      assert refs |> Enum.map(& &1.asset_id) |> Enum.sort() == [asset_a.id, asset_b.id]
      assert asset_ref_count(asset_a.id) == 2
      assert asset_ref_count(asset_b.id) == 2
      assert asset_ref_count(asset_c.id) == 0

      assert {:ok, %{body: refs, cover: []}} =
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{usage: :attachment, asset_id: asset_b.id, block_id: "asset-b"},
                     %{usage: :attachment, asset_id: asset_c.id, block_id: "asset-c"}
                   ]
                 },
                 community: community
               )

      assert refs |> Enum.map(& &1.asset_id) |> Enum.sort() == [asset_b.id, asset_c.id]

      refs_by_owner = article_refs(:post, post.id)
      current_working_copy_refs = Enum.filter(refs_by_owner, &(not is_nil(&1.working_copy_id)))
      snapshot_refs = Enum.filter(refs_by_owner, &(not is_nil(&1.snapshot_id)))

      assert Enum.map(current_working_copy_refs, & &1.asset_id) |> Enum.sort() ==
               [asset_b.id, asset_c.id]

      assert Enum.frequencies_by(snapshot_refs, & &1.asset_id) == %{
               asset_a.id => 1,
               asset_b.id => 2,
               asset_c.id => 1
             }

      assert asset_ref_count(asset_a.id) == 1
      assert asset_ref_count(asset_b.id) == 3
      assert asset_ref_count(asset_c.id) == 2
    end

    test "replaces one WorkingCopy attachment with a revision and source guard",
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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "replace-me"}
                   ]
                 },
                 community: community
               )

      work = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)
      workflow_ref = "asset-replacement:test:#{post.id}"
      operation_ref = Ecto.UUID.generate()

      params = %{
        revision: work.revision,
        usage: :attachment,
        block_id: "replace-me",
        from_asset_id: from_asset.id,
        to_asset_id: to_asset.id
      }

      from_asset_id = from_asset.id
      to_asset_id = to_asset.id

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: false},
                 :operations,
                 Ecto.UUID.generate()
               )

      assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
               CMS.Assets.replace_use(post, params, user, Ecto.UUID.generate())

      assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
               CMS.Assets.replace_use_workflow(post, params, user, workflow_ref, operation_ref)

      assert {:error, :operation_ref_required} =
               CMS.Assets.replace_use_workflow(post, params, user, workflow_ref, nil)

      assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision

      assert %ArticleAssetRef{asset_id: ^from_asset_id} =
               Repo.get_by!(ArticleAssetRef, working_copy_id: work.id, block_id: "replace-me")

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: nil},
                 :operations,
                 Ecto.UUID.generate()
               )

      assert {:ok, %{revision: revision, workflow_ref: ^workflow_ref}} =
               CMS.Assets.replace_use_workflow(
                 post,
                 %{
                   revision: work.revision,
                   usage: :attachment,
                   block_id: "replace-me",
                   from_asset_id: from_asset.id,
                   to_asset_id: to_asset.id
                 },
                 user,
                 workflow_ref,
                 operation_ref
               )

      assert revision == work.revision + 1

      assert %ArticleAssetRef{asset_id: ^to_asset_id} =
               Repo.get_by!(ArticleAssetRef, working_copy_id: work.id, block_id: "replace-me")

      assert Enum.any?(article_refs(:post, post.id), fn ref ->
               not is_nil(ref.snapshot_id) and ref.asset_id == from_asset.id
             end)

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: false},
                 :operations,
                 Ecto.UUID.generate()
               )

      assert {:ok, %{revision: ^revision, workflow_ref: ^workflow_ref}} =
               CMS.Assets.replace_use_workflow(
                 post,
                 %{
                   revision: work.revision,
                   usage: :attachment,
                   block_id: "replace-me",
                   from_asset_id: from_asset.id,
                   to_asset_id: to_asset.id
                 },
                 user,
                 workflow_ref,
                 operation_ref
               )

      assert {:error, %ErrorCat.Error{reason: :published_article_editing_disabled}} =
               CMS.Assets.replace_use_workflow(
                 post,
                 %{
                   revision: revision,
                   usage: :attachment,
                   block_id: "replace-me",
                   from_asset_id: to_asset.id,
                   to_asset_id: from_asset.id
                 },
                 user,
                 "asset-replacement:new-step:#{post.id}",
                 Ecto.UUID.generate()
               )

      assert Repo.get!(ArticleWorkingCopy, work.id).revision == revision

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: nil},
                 :operations,
                 Ecto.UUID.generate()
               )

      command_id = Ecto.UUID.generate()

      receipt_params = %{
        params
        | revision: revision,
          from_asset_id: to_asset.id,
          to_asset_id: from_asset.id
      }

      assert {:ok, %{revision: receipt_revision}} =
               CMS.Assets.replace_use(post, receipt_params, user, command_id)

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: false},
                 :operations,
                 Ecto.UUID.generate()
               )

      assert {:ok, %{revision: ^receipt_revision}} =
               CMS.Assets.replace_use(post, receipt_params, user, command_id)

      assert {:ok, _} =
               CMS.Dashboard.update(
                 community,
                 :enable,
                 %{post_published_editing: nil},
                 :operations,
                 Ecto.UUID.generate()
               )

      {:ok, editor} = db_insert(:user)

      editor = %{
        editor
        | cur_passport: %{"global" => %{}, community.slug => %{"cms" => %{"post.edit" => true}}}
      }

      assert {:error, %CMS.Gate.Decision{}} =
               CMS.Gate.access_check(editor, :edit_article, post)

      editor_params = %{
        params
        | revision: receipt_revision,
          from_asset_id: from_asset.id,
          to_asset_id: to_asset.id
      }

      editor_command_id = Ecto.UUID.generate()

      assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
               CMS.Assets.replace_use(post, editor_params, editor, editor_command_id)

      editor = %{
        editor
        | cur_passport: %{
            "global" => %{},
            community.slug => %{"cms" => %{"post.edit" => false}}
          }
      }

      assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
               CMS.Assets.replace_use(post, editor_params, editor, editor_command_id)
    end

    test "replacement targets the selected WorkingCopy without changing the default copy",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("fork-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("fork-b.png", 10),
          user,
          Ecto.UUID.generate()
        )

      public = Repo.get!(ArticlePublic, post.id)

      assert {:ok, %{working_copy: work}} =
               CMS.Articles.fork_snapshot(
                 public.snapshot_id,
                 community,
                 :workspace,
                 Ecto.UUID.generate(),
                 user,
                 Ecto.UUID.generate()
               )

      article = Repo.get!(Article, post.id)

      assert {:ok, work} =
               CMS.Articles.save_working_copy(
                 article,
                 community,
                 work.id,
                 %{
                   asset_refs: [%{usage: :attachment, asset_id: from_asset.id, block_id: "fork"}]
                 },
                 work.revision,
                 user,
                 Ecto.UUID.generate()
               )

      default = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)

      params = %{
        working_copy_id: work.id,
        revision: work.revision,
        usage: :attachment,
        block_id: "fork",
        from_asset_id: from_asset.id,
        to_asset_id: to_asset.id
      }

      command_id = Ecto.UUID.generate()

      assert {:ok, %{revision: next, working_copy_id: work_id}} =
               CMS.Assets.replace_use(post, params, user, command_id)

      assert work_id == work.id

      assert {:ok, %{revision: ^next, working_copy_id: ^work_id}} =
               CMS.Assets.replace_use(post, params, user, command_id)

      assert next == work.revision + 1
      assert Repo.get!(ArticleWorkingCopy, default.id).revision == default.revision

      assert Repo.get_by!(ArticleAssetRef, working_copy_id: work.id, block_id: "fork").asset_id ==
               to_asset.id
    end

    test "replacement plan keeps distinct WorkingCopies and identical locators separate",
         ~m(community post user)a do
      {:ok, from_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("copies-a.png", 10),
          user,
          Ecto.UUID.generate()
        )

      {:ok, to_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("copies-b.png", 10),
          user,
          Ecto.UUID.generate()
        )

      article = Repo.get!(Article, post.id)
      public = Repo.get!(ArticlePublic, post.id)
      default = Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default)

      assert {:ok, %{working_copy: other}} =
               CMS.Articles.fork_snapshot(
                 public.snapshot_id,
                 community,
                 :workspace,
                 Ecto.UUID.generate(),
                 user,
                 Ecto.UUID.generate()
               )

      copies =
        for work <- [default, other] do
          assert {:ok, saved} =
                   CMS.Articles.save_working_copy(
                     article,
                     community,
                     work.id,
                     %{
                       asset_refs: [
                         %{usage: :attachment, asset_id: from_asset.id, block_id: "same"}
                       ]
                     },
                     work.revision,
                     user,
                     Ecto.UUID.generate()
                   )

          saved
        end

      assert {:ok, plan} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      editable_items =
        Enum.filter(plan.items, &((&1[:decision] || &1["decision"]) == "editable"))

      historical_items =
        Enum.filter(plan.items, &((&1[:decision] || &1["decision"]) == "historical_only"))

      assert MapSet.new(
               Enum.map(editable_items, &(&1[:working_copy_id] || &1["working_copy_id"]))
             ) == MapSet.new(Enum.map(copies, & &1.id))

      assert length(historical_items) == 1

      assert {:ok, applied} = CMS.Assets.apply_replacement_plan(plan, user)
      assert applied.status == :completed

      [skipped_historical_item] =
        Enum.filter(applied.items, &((&1[:decision] || &1["decision"]) == "historical_only"))

      historical_result = skipped_historical_item[:result] || skipped_historical_item["result"]
      assert (historical_result[:status] || historical_result["status"]) in [:skipped, "skipped"]

      for work <- copies do
        assert Repo.get_by!(ArticleAssetRef, working_copy_id: work.id, block_id: "same").asset_id ==
                 to_asset.id

        assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision + 1
      end

      assert {:ok, replayed} = CMS.Assets.apply_replacement_plan(applied, user)
      assert replayed.status == :completed
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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "plan-block"}
                   ]
                 },
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{status: :pending, items: items}} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert length(items) == 2
      [item] = Enum.filter(items, &((&1[:decision] || &1["decision"]) == "editable"))

      [historical_item] =
        Enum.filter(items, &((&1[:decision] || &1["decision"]) == "historical_only"))

      assert (item[:article_id] || item["article_id"]) == post.id

      assert (item[:observed_working_copy_revision] || item["observed_working_copy_revision"]) ==
               Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default).revision

      assert (item[:decision] || item["decision"]) == "editable"
      locators = item[:usage_locators] || item["usage_locators"]
      assert [%{block_id: "plan-block"}] = locators

      historical_locators = historical_item[:usage_locators] || historical_item["usage_locators"]
      assert [%{block_id: "plan-block"}] = historical_locators
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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "resume-block"}
                   ]
                 },
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{} = plan} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert {:ok, %AssetReplacementPlan{status: :completed, apply_run_ref: run_ref} = applied} =
               CMS.Assets.apply_replacement_plan(plan, user)

      assert is_binary(run_ref)
      [item] = Enum.filter(applied.items, &((&1[:decision] || &1["decision"]) == "editable"))
      [locator] = item[:usage_locators] || item["usage_locators"]
      assert (locator[:status] || locator["status"]) == "succeeded"

      [historical_item] =
        Enum.filter(applied.items, &((&1[:decision] || &1["decision"]) == "historical_only"))

      historical_result = historical_item[:result] || historical_item["result"]
      assert (historical_result[:status] || historical_result["status"]) in [:skipped, "skipped"]

      persisted = Repo.get!(AssetReplacementPlan, applied.id)

      [persisted_item] =
        Enum.filter(persisted.items, &((&1[:decision] || &1["decision"]) == "editable"))

      persisted_result = persisted_item[:result] || persisted_item["result"]
      assert (persisted_result[:status] || persisted_result["status"]) in [:applied, "applied"]

      assert {:ok, %AssetReplacementPlan{status: :completed, apply_run_ref: ^run_ref}} =
               CMS.Assets.apply_replacement_plan(applied, user)
    end

    test "keeps a subset apply run pending until every article is selected",
         ~m(community post user)a do
      {_community, other_post, _attrs, _other_user} =
        mock_article_after_throttle(:post, community, user)

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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "subset-one"}
                   ]
                 },
                 community: community
               )

      assert {:ok, %{body: [_]}} =
               test_link_refs(
                 other_post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "subset-two"}
                   ]
                 },
                 community: community
               )

      assert {:ok, %AssetReplacementPlan{} = plan} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert {:ok, %AssetReplacementPlan{status: :completed} = partial} =
               CMS.Assets.apply_replacement_plan(
                 plan,
                 user,
                 article_ids: [post.id]
               )

      run = Repo.get_by!(AssetWorkflowRun, workflow_ref: partial.apply_run_ref)
      assert run.status == :pending

      step_statuses = Repo.all(AssetWorkflowStep) |> Enum.map(& &1.status)
      assert Enum.count(step_statuses, &(&1 == :succeeded)) == 1
      assert Enum.count(step_statuses, &(&1 == :pending)) == 1
      assert Enum.count(step_statuses, &(&1 == :skipped)) == 2

      assert [%AssetWorkflowStep{resource_id: pending_article_id}] =
               Repo.all(AssetWorkflowStep) |> Enum.filter(&(&1.status == :pending))

      assert pending_article_id == to_string(other_post.id)

      historical_items =
        Enum.filter(partial.items, fn item ->
          (item[:decision] || item["decision"]) in [:historical_only, "historical_only"]
        end)

      assert length(historical_items) == 2

      assert Enum.all?(historical_items, fn item ->
               result = item[:result] || item["result"]
               (result[:status] || result["status"]) in [:skipped, "skipped"]
             end)

      assert {:ok, %AssetReplacementPlan{status: :completed}} =
               CMS.Assets.apply_replacement_plan(
                 partial,
                 user,
                 article_ids: [other_post.id]
               )

      assert Repo.get_by!(AssetWorkflowRun, workflow_ref: partial.apply_run_ref).status ==
               :completed
    end

    test "skips historical-only plan items without creating a draft",
         ~m(community user)a do
      {_community, historical_post, _attrs, _other_user} =
        mock_article_after_throttle(:post, community, user)

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
              observed_live_snapshot_id: nil,
              observed_working_copy_revision: nil,
              usage_locators: [%{step_ref: step_ref, usage: "inline", block_id: "historical"}],
              result: nil
            }
          ]
        })
        |> Repo.insert()

      before_copies =
        Repo.all(from(work in ArticleWorkingCopy, where: work.article_id == ^historical_post.id))

      assert {:ok, %AssetReplacementPlan{status: :completed} = applied} =
               CMS.Assets.apply_replacement_plan(plan, user, article_ids: [historical_post.id])

      [item] = applied.items
      result = item[:result] || item["result"]
      value = result[:value] || result["value"]
      assert (result[:status] || result["status"]) in [:skipped, "skipped"]
      assert (value[:reason] || value["reason"]) == "historical_only"

      assert [%AssetWorkflowStep{status: :skipped, result: %{"reason" => "plan_decision"}}] =
               Repo.all(AssetWorkflowStep)

      assert Repo.all(
               from(work in ArticleWorkingCopy, where: work.article_id == ^historical_post.id)
             ) == before_copies
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
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [
                     %{
                       usage: :attachment,
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
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   cover_asset: cover_asset
                 },
                 community: community
               )

      refs_before_invalid_body = article_refs(:post, post.id)

      for usage <- [:cover, "cover_dark"] do
        assert {:error,
                %ErrorCat.Error{
                  reason: :custom,
                  details: "explicit Article asset refs must be attachments"
                }} =
                 test_link_refs(
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

        refs_after_invalid_body = article_refs(:post, post.id)
        assert refs_after_invalid_body == refs_before_invalid_body
        assert Enum.any?(refs_after_invalid_body, &(&1.id == cover_ref.id and &1.usage == :cover))
      end
    end

    test "concurrent ref saves reject a stale WorkingCopy revision", ~m(community post user)a do
      parent = self()

      revision =
        Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default).revision

      tasks =
        ["sync-a.png", "sync-b.png"]
        |> Enum.with_index()
        |> Enum.map(fn {filename, index} ->
          Task.async(fn ->
            send(parent, {:task_ready, self()})

            receive do
              :go ->
                test_link_refs(
                  post,
                  %{
                    cur_user: user,
                    asset_refs: [
                      %{
                        usage: :attachment,
                        asset: image_asset_attrs(filename, 20 + index),
                        source: filename
                      }
                    ]
                  },
                  community: community,
                  revision: revision
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

      results = Enum.map(tasks, &Task.await(&1, 5_000))
      assert Enum.count(results, &match?({:ok, %{body: [_], cover: []}}, &1)) == 1

      assert Enum.count(
               results,
               &match?({:error, %{reason: :article_working_copy_revision_conflict}}, &1)
             ) == 1

      refs = article_refs(:post, post.id)
      working_copy_refs = Enum.filter(refs, &(not is_nil(&1.working_copy_id)))
      snapshot_refs = Enum.filter(refs, &(not is_nil(&1.snapshot_id)))

      assert length(working_copy_refs) == 1
      assert hd(working_copy_refs).source in ["sync-a.png", "sync-b.png"]
      assert length(snapshot_refs) == 1
      assert hd(snapshot_refs).source == hd(working_copy_refs).source
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
          %{usage: :attachment, asset_id: asset.id, position: position}
        end)

      assert {:ok, %{body: refs, cover: []}} =
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: asset_refs
                 },
                 community: community
               )

      assert length(refs) == 105

      {:ok, paged_refs} =
        CMS.Assets.refs(
          community,
          asset.id,
          %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
          user
        )

      assert length(paged_refs.entries) == 20
      assert paged_refs.total_count == 210
      assert paged_refs.total_pages == 11
      assert paged_refs.page == 1

      {:ok, second_page_refs} =
        CMS.Assets.refs(
          community,
          asset.id,
          %GroupherServer.Pagi.Params.Offset{page: 2, size: 20},
          user
        )

      assert length(second_page_refs.entries) == 20
      assert second_page_refs.total_count == 210
      assert second_page_refs.total_pages == 11
      assert second_page_refs.page == 2

      first_page_ids = paged_refs.entries |> Enum.map(& &1.id) |> MapSet.new()
      second_page_ids = second_page_refs.entries |> Enum.map(& &1.id) |> MapSet.new()

      assert MapSet.disjoint?(first_page_ids, second_page_ids)

      {result, queries} =
        capture_queries(fn ->
          CMS.Assets.refs(community, asset.id, %{cursor: %{first: 20}}, user)
        end)

      assert {:ok, %{entries: first_cursor_entries, end_cursor: cursor}} = result
      assert Enum.map(first_cursor_entries, & &1.id) == Enum.map(paged_refs.entries, & &1.id)
      refute Enum.any?(queries, &String.contains?(String.downcase(&1), "count("))

      assert {:ok, %{entries: next_entries}} =
               CMS.Assets.refs(community, asset.id, %{cursor: %{first: 20, after: cursor}}, user)

      assert Enum.map(next_entries, & &1.id) == Enum.map(second_page_refs.entries, & &1.id)

      {:ok, other_asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("other-refs.png", 70),
          user,
          Ecto.UUID.generate()
        )

      assert {:error, _} =
               CMS.Assets.refs(
                 community,
                 other_asset.id,
                 %{cursor: %{first: 20, after: cursor}},
                 user
               )
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

      assert Repo.aggregate(
               from(a in CommunityAsset, where: a.community_id == ^community.id),
               :count,
               :id
             ) == 1
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

      assert Repo.aggregate(
               from(a in CommunityAsset, where: a.community_id == ^community.id),
               :count,
               :id
             ) == 0
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

      assert {:ok, %{run_ref: ^workflow_ref, status: :pending, enqueued: 0, skipped: 1}} =
               CMS.Assets.ProviderReconciliation.enqueue_missing(
                 community,
                 workflow_ref: workflow_ref,
                 age_seconds: 0
               )

      assert Repo.get_by!(AssetWorkflowRun, workflow_ref: workflow_ref).status == :pending

      assert [
               %AssetWorkflowStep{
                 status: :pending,
                 operation_ref: _operation_ref,
                 result: %{}
               }
             ] =
               Repo.all(AssetWorkflowStep)

      refute Repo.get_by(CMS.Outbox.Event,
               event: "asset.provider_delete",
               resource_id: to_string(asset.id)
             )
    end

    test "provider reconciliation rejects existing delete events with a mismatched contract",
         ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("provider-contract.png", 80)
          |> Map.merge(%{storage: "r2", storage_key: "provider-contract/original"}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)
      assert {:ok, _deleted} = CMS.Assets.Persist.delete(community, asset.id)

      event =
        Repo.insert!(%CMS.Outbox.Event{
          id: Ecto.UUID.generate(),
          event: "asset.provider_delete",
          contract_version: 1,
          worker: inspect(GroupherServer.Jobs.CMSOutboxAsset),
          resource_type: "community_asset",
          resource_id: to_string(asset.id),
          operation_ref: Ecto.UUID.generate(),
          dedupe_key:
            CMS.Outbox.DedupeKey.encode([asset.public_ref, asset.storage, asset.storage_key]),
          data: %{
            "asset_id" => asset.id,
            "public_ref" => asset.public_ref,
            "storage" => asset.storage,
            "storage_key" => asset.storage_key
          },
          status: :waiting,
          attempts: 0,
          failure_generation: 0,
          available_at: DateTime.utc_now(:second)
        })

      outbox_event_id = event.id
      event_data = event.data
      event_worker = event.worker

      mismatches = [
        %{data: Map.put(event.data, "storage_key", "other/object")},
        %{contract_version: 2},
        %{worker: "Elixir.GroupherServer.Jobs.UnexpectedAssetWorker"}
      ]

      previous_env = Application.get_env(:groupher_server, :env)
      Application.put_env(:groupher_server, :env, :dev)

      on_exit(fn ->
        if is_nil(previous_env) do
          Application.delete_env(:groupher_server, :env)
        else
          Application.put_env(:groupher_server, :env, previous_env)
        end
      end)

      valid_workflow_ref = "provider-contract-valid:#{community.id}"

      assert {:ok, %{run_ref: ^valid_workflow_ref, status: :completed, enqueued: 0, skipped: 1}} =
               CMS.Assets.ProviderReconciliation.enqueue_missing(
                 community,
                 workflow_ref: valid_workflow_ref,
                 age_seconds: -1
               )

      valid_run = Repo.get_by!(AssetWorkflowRun, workflow_ref: valid_workflow_ref)

      assert %AssetWorkflowStep{
               status: :succeeded,
               result: %{
                 "outcome" => "existing",
                 "outbox_event_id" => ^outbox_event_id
               }
             } = Repo.get_by!(AssetWorkflowStep, run_id: valid_run.id)

      for {mismatch, index} <- Enum.with_index(mismatches) do
        Repo.get!(CMS.Outbox.Event, outbox_event_id)
        |> CMS.Outbox.Event.changeset(
          Map.merge(
            %{contract_version: 1, worker: event_worker, data: event_data},
            mismatch
          )
        )
        |> Repo.update!()

        workflow_ref = "provider-contract:#{community.id}:#{index}"

        assert {:error, :provider_delete_event_identity_mismatch} =
                 CMS.Assets.ProviderReconciliation.enqueue_missing(
                   community,
                   workflow_ref: workflow_ref,
                   age_seconds: -1
                 )

        assert Repo.get_by!(AssetWorkflowRun, workflow_ref: workflow_ref).status == :failed

        assert Repo.get_by!(AssetWorkflowStep,
                 run_id: Repo.get_by!(AssetWorkflowRun, workflow_ref: workflow_ref).id,
                 resource_id: to_string(asset.id)
               ).status == :failed
      end
    end

    test "provider reconciliation requeues the same dead intent on a later leased run",
         ~m(community user)a do
      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("provider-recovery.png", 80)
          |> Map.merge(%{storage: "r2", storage_key: "provider-recovery/original"}),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _receipt} = CMS.Assets.backfill_usage(community)
      assert {:ok, _deleted} = CMS.Assets.Persist.delete(community, asset.id)

      endpoint = start_provider_delete_endpoint(503)
      endpoint_before = System.get_env("ASSETS_HUB_DELETE_ENDPOINT")
      service_token_key = {"https://assets.groupher.com/internal", ["assets:object:delete"]}
      previous_token = :ets.lookup(:groupher_service_token_cache, service_token_key)
      previous_endpoint_pid = Application.get_env(:groupher_server, :asset_provider_test_pid)
      previous_status = Application.get_env(:groupher_server, :asset_provider_test_status)

      System.put_env("ASSETS_HUB_DELETE_ENDPOINT", endpoint)

      :ets.insert(
        :groupher_service_token_cache,
        {service_token_key, "test-service-token", System.system_time(:second) + 3_600}
      )

      Application.put_env(:groupher_server, :asset_provider_test_pid, self())
      Application.put_env(:groupher_server, :asset_provider_test_status, 503)

      on_exit(fn ->
        restore_env("ASSETS_HUB_DELETE_ENDPOINT", endpoint_before)
        restore_application_env(:asset_provider_test_pid, previous_endpoint_pid)
        restore_application_env(:asset_provider_test_status, previous_status)

        :ets.delete(:groupher_service_token_cache, service_token_key)

        case previous_token do
          [entry] -> :ets.insert(:groupher_service_token_cache, entry)
          [] -> :ok
        end
      end)

      with_jobs_enabled(fn ->
        first_workflow_ref = "provider-recovery:r1:#{community.id}"

        assert {:ok, %{run_ref: ^first_workflow_ref, status: :completed, enqueued: 1, skipped: 0}} =
                 CMS.Assets.reconcile_provider_deletions(community,
                   workflow_ref: first_workflow_ref,
                   age_seconds: -1
                 )

        first_run = Repo.get_by!(AssetWorkflowRun, workflow_ref: first_workflow_ref)

        assert %AssetWorkflowStep{status: :succeeded} =
                 first_step = Repo.get_by!(AssetWorkflowStep, run_id: first_run.id)

        first_event = Repo.get_by!(CMS.Outbox.Event, event: "asset.provider_delete")
        first_event_id = first_event.id

        assert {:ok, :pass} =
                 GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
                   args: %{"event_id" => first_event.id},
                   attempt: 8,
                   max_attempts: 8
                 })

        assert %CMS.Outbox.Event{status: :failed, last_error_code: "5603"} =
                 first_event = Repo.get!(CMS.Outbox.Event, first_event.id)

        assert_receive {:asset_provider_delete_request, 503, "/internal/assets/delete",
                        ["Bearer test-service-token"], payload}

        assert payload["assetPublicRef"] == asset.public_ref
        assert payload["storageKey"] == asset.storage_key

        assert first_event.failure_generation == 1

        Repo.update_all(
          from(job in Oban.Job,
            where: fragment("?->>'event_id' = ?", job.args, ^first_event.id)
          ),
          set: [state: "completed", completed_at: DateTime.utc_now(:second)]
        )

        first_operation_ref = first_event.operation_ref
        first_event_data = first_event.data
        first_dedupe_key = first_event.dedupe_key
        second_workflow_ref = "provider-recovery:r2:#{community.id}"

        assert {:ok,
                %{run_ref: ^second_workflow_ref, status: :completed, enqueued: 1, skipped: 0}} =
                 CMS.Assets.reconcile_provider_deletions(community,
                   workflow_ref: second_workflow_ref,
                   age_seconds: -1
                 )

        second_run = Repo.get_by!(AssetWorkflowRun, workflow_ref: second_workflow_ref)

        assert %AssetWorkflowStep{
                 status: :succeeded,
                 result: %{
                   "outcome" => "requeued",
                   "outbox_event_id" => ^first_event_id
                 }
               } = second_step = Repo.get_by!(AssetWorkflowStep, run_id: second_run.id)

        assert %CMS.Outbox.Event{
                 status: :waiting,
                 failure_generation: 1,
                 operation_ref: ^first_operation_ref,
                 dedupe_key: ^first_dedupe_key,
                 data: ^first_event_data
               } = Repo.get!(CMS.Outbox.Event, first_event.id)

        assert first_step.operation_ref == first_operation_ref
        assert second_step.operation_ref != first_operation_ref

        assert %CMS.Outbox.Retry{
                 initiator_kind: "owner",
                 reason_code: "provider_delete_retry",
                 original_operation_ref: ^first_operation_ref,
                 retry_operation_ref: retry_operation_ref
               } =
                 Repo.get_by!(CMS.Outbox.Retry,
                   event_id: first_event.id,
                   failure_generation: 1
                 )

        assert retry_operation_ref == second_step.operation_ref

        assert Repo.aggregate(
                 from(event in CMS.Outbox.Event, where: event.id == ^first_event.id),
                 :count,
                 :id
               ) == 1

        assert Repo.aggregate(
                 from(job in Oban.Job,
                   where: fragment("?->>'event_id' = ?", job.args, ^first_event.id)
                 ),
                 :count,
                 :id
               ) == 2

        Application.put_env(:groupher_server, :asset_provider_test_status, 200)

        assert {:ok, :pass} =
                 GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
                   args: %{"event_id" => first_event.id},
                   attempt: 1,
                   max_attempts: 8
                 })

        assert_receive {:asset_provider_delete_request, 200, "/internal/assets/delete",
                        ["Bearer test-service-token"], _payload}

        assert Repo.get!(CMS.Outbox.Event, first_event.id).status == :done
      end)
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
               test_link_refs(
                 post,
                 %{cur_user: user, asset_refs: [%{usage: :attachment, asset_id: referenced.id}]},
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
        test_link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [%{usage: :attachment, asset: asset_attrs, block_id: "referenced"}]
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
        test_link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [
              %{usage: :attachment, asset: asset_attrs, block_id: "soft-delete-keeps-refs"}
            ]
          },
          community: community
        )

      assert asset_ref_count(ref.asset_id) == 2
      refs_before_trash = article_refs(:post, post.id)
      assert Enum.count(refs_before_trash, &(not is_nil(&1.working_copy_id))) == 1
      assert Enum.count(refs_before_trash, &(not is_nil(&1.snapshot_id))) == 1

      assert {:ok, _trash_item} = CMS.Articles.trash(post, user)

      assert asset_ref_count(ref.asset_id) == 2

      assert Enum.map(article_refs(:post, post.id), & &1.id) ==
               Enum.map(refs_before_trash, & &1.id)
    end

    test "permanently deleting an article cleans up document asset refs",
         ~m(community post user)a do
      asset_attrs = image_asset_attrs("delete-cleanup.png", 90)

      {:ok, %{body: [ref]}} =
        test_link_refs(
          post,
          %{
            cur_user: user,
            asset_refs: [%{usage: :attachment, asset: asset_attrs, block_id: "delete-cleanup"}]
          },
          community: community
        )

      refs_before_trash = article_refs(:post, post.id)
      assert length(refs_before_trash) == 2
      assert Enum.count(refs_before_trash, &(not is_nil(&1.working_copy_id))) == 1
      assert Enum.count(refs_before_trash, &(not is_nil(&1.snapshot_id))) == 1

      assert {:ok, trash_item} = CMS.Articles.trash(post, user)
      assert asset_ref_count(ref.asset_id) == 2

      assert {:ok, %{done: true}} =
               CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

      assert article_refs(:post, post.id) == []
      assert asset_ref_count(ref.asset_id) == 0
      assert {:ok, %CommunityAsset{}} = ORM.find(CommunityAsset, ref.asset_id)
    end

    test "permanently deleting one article keeps shared asset refs from other articles",
         ~m(community post user)a do
      {_community, other_post, _attrs, _user} =
        mock_article_after_throttle(:post, community, user)

      assert {:ok, _draft} = open_draft(other_post, user)

      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          image_asset_attrs("shared.png", 90),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, %{body: [_]}} =
               test_link_refs(
                 post,
                 %{
                   cur_user: user,
                   asset_refs: [%{usage: :attachment, asset_id: asset.id, block_id: "shared-one"}]
                 },
                 community: community
               )

      assert {:ok, %{body: [_]}} =
               test_link_refs(
                 other_post,
                 %{
                   cur_user: user,
                   asset_refs: [%{usage: :attachment, asset_id: asset.id, block_id: "shared-two"}]
                 },
                 community: community
               )

      assert asset_ref_count(asset.id) == 4

      assert {:ok, trash_item} = CMS.Articles.trash(post, user)

      assert {:ok, %{done: true}} =
               CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

      assert asset_ref_count(asset.id) == 2
      assert article_refs(:post, post.id) == []
      other_refs = article_refs(:post, other_post.id)
      assert length(other_refs) == 2
      assert Enum.count(other_refs, &(not is_nil(&1.working_copy_id))) == 1
      assert Enum.count(other_refs, &(not is_nil(&1.snapshot_id))) == 1
    end

    test "keeps the default WorkingCopy revision when usage also includes a Snapshot",
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
               test_link_refs(
                 post,
                 %{
                   asset_refs: [
                     %{usage: :attachment, asset_id: from_asset.id, block_id: "mixed-draft"}
                   ]
                 },
                 community: community
               )

      public = Repo.get_by!(ArticlePublic, article_id: post.id)

      %ArticleAssetRef{}
      |> ArticleAssetRef.changeset(%{
        community_id: community.id,
        asset_id: from_asset.id,
        snapshot_id: public.snapshot_id,
        usage: :inline,
        block_id: "mixed-live"
      })
      |> Ecto.Changeset.put_change(
        :inserted_at,
        DateTime.add(DateTime.utc_now(:second), 5, :second)
      )
      |> Repo.insert!()

      assert {:ok, %AssetReplacementPlan{items: items}} =
               CMS.Assets.create_replacement_plan(
                 community,
                 %{from_asset_id: from_asset.id, to_asset_id: to_asset.id},
                 user
               )

      assert length(items) == 2
      item = Enum.find(items, &((&1[:decision] || &1["decision"]) == "editable"))
      assert Enum.any?(items, &((&1[:decision] || &1["decision"]) == "live_snapshot_only"))

      assert (item[:observed_working_copy_revision] || item["observed_working_copy_revision"]) ==
               Repo.get_by!(ArticleWorkingCopy, article_id: post.id, scope_type: :default).revision
    end
  end

  defp test_link_refs(article, attrs, opts) do
    community = Keyword.fetch!(opts, :community)
    canonical = Repo.get!(Article, article.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_type: :default)

    actor =
      Map.get(attrs, :cur_user) ||
        Repo.get!(GroupherServer.Accounts.Model.User, work.updated_by_id)

    with {:ok, saved} <-
           CMS.Articles.save_working_copy(
             canonical,
             community,
             work.id,
             attrs,
             Keyword.get(opts, :revision, work.revision),
             actor,
             Ecto.UUID.generate()
           ) do
      refs = CMS.Assets.Refs.working_copy_refs(saved.id)

      {:ok,
       %{
         body: Enum.reject(refs, &(&1.usage in [:cover, :cover_dark])),
         cover: Enum.filter(refs, &(&1.usage in [:cover, :cover_dark]))
       }}
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
    _user = user
    article = Repo.get!(Article, article_view.id)

    case Repo.get_by(ArticleWorkingCopy,
           article_id: article.id,
           scope_type: :default,
           scope_id: article.id
         ) do
      %ArticleWorkingCopy{} = working_copy -> {:ok, working_copy}
      nil -> {:error, :working_copy_not_found}
    end
  end

  defp article_refs(thread, article_id) do
    ArticleAssetRef
    |> join(:left, [ref], working_copy in ArticleWorkingCopy,
      on: working_copy.id == ref.working_copy_id
    )
    |> join(:left, [ref, _working_copy], snapshot in ArticleSnapshot,
      on: snapshot.id == ref.snapshot_id
    )
    |> join(:inner, [ref, working_copy, snapshot], article in Article,
      on: article.id == working_copy.article_id or article.id == snapshot.article_id
    )
    |> where(
      [_ref, _working_copy, _snapshot, article],
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

  defp grant_ticket_actions(community, user) do
    permissions =
      ~w(ticket.create ticket.link_source ticket.read_internal ticket.update ticket.manage_visibility)
      |> Map.new(&{&1, true})

    case Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) do
      %CommunityAdmin{} = member ->
        member
        |> CommunityAdmin.changeset(%{permissions: Map.merge(member.permissions, permissions)})
        |> Repo.update!()

      nil ->
        %CommunityAdmin{}
        |> CommunityAdmin.changeset(%{
          user_id: user.id,
          community_id: community.id,
          permissions: permissions
        })
        |> Repo.insert!()
    end

    user
  end

  defp mock_article_after_throttle(thread, community, user) do
    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: user.id},
      minutes: -@throttle_interval
    )

    mock_article(thread, community, user)
  end

  defp mock_article_in_next_publish_window(thread, community, user, index) do
    if rem(index, @throttle_hour_limit) == 0 do
      CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
        :publish_hour,
        %User{id: user.id},
        hours: -1
      )
    end

    if rem(index, @throttle_day_limit) == 0 do
      CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
        :publish_date,
        %User{id: user.id},
        days: -2
      )
    end

    mock_article_after_throttle(thread, community, user)
  end

  defp start_provider_delete_endpoint(status) do
    ref = Module.concat(__MODULE__, "ProviderDeleteEndpoint#{System.unique_integer([:positive])}")
    Application.put_env(:groupher_server, :asset_provider_test_status, status)
    {:ok, _pid} = Plug.Cowboy.http(ProviderDeleteEndpoint, [], port: 0, ref: ref)
    on_exit(fn -> Plug.Cowboy.shutdown(ref) end)

    "http://127.0.0.1:#{:ranch.get_port(ref)}"
  end

  defp with_jobs_enabled(action) do
    unless Oban.Registry.whereis(Oban) do
      start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    end

    previous_env = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      action.()
    after
      restore_application_env(:env, previous_env)
    end
  end

  defp restore_application_env(key, nil) do
    Application.delete_env(:groupher_server, key)
  end

  defp restore_application_env(key, value) do
    Application.put_env(:groupher_server, key, value)
  end

  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)
end
