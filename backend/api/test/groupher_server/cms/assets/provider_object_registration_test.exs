defmodule GroupherServer.Test.CMS.Assets.ProviderObjectRegistrationTest do
  use GroupherServer.TestMate, async: false

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.CMS

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleEvent,
    ArticleWorkingCopy,
    AssetUpload,
    CommandReceipt,
    CommunityApplicationLogoUpload,
    CommunityAsset
  }

  alias CMS.Outbox.{Event, Retry}

  defmodule Endpoint do
    @moduledoc false
    import Plug.Conn
    def init(options), do: options

    def call(conn, options) do
      {:ok, body, conn} = read_body(conn)
      send(Keyword.fetch!(options, :parent), {:provider_received, Jason.decode!(body)})

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(200, ~s({"ok":true,"result":{"enqueued":true}}))
    end
  end

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    on_exit(fn -> Application.put_env(:groupher_server, :env, previous) end)
    :ok
  end

  for entry <- [
        :register,
        :ordinary_upload,
        :generated_upload,
        :application_upload,
        :article_cover
      ],
      state <- [:deleted, :foreign_active] do
    @entry entry
    @state state
    test "#{entry} rejects a #{@state} storage owner without changing it or completing downstream work" do
      owner = fixture()
      target = if @state == :foreign_active, do: fixture(), else: owner
      prepared = prepare(@entry, target)
      assert {:ok, asset} = register(owner, prepared.attrs)

      if @state == :deleted do
        assert {:ok, %{status: :deleted}} = delete_asset(owner, asset)
      end

      before = facts()
      command_id = Ecto.UUID.generate()
      assert_conflict(invoke(@entry, target, prepared, command_id))
      assert facts() == before
      refute Repo.get_by(CommandReceipt, command_id: command_id)

      assert_entry_failure(@entry, target, prepared, command_id, before)
    end
  end

  test "a generated upload reuses the same active object in its own Community" do
    f = fixture()
    prepared = prepare(:generated_upload, f)
    assert {:ok, original} = register(f, prepared.attrs)
    assert {:ok, reused} = CMS.Assets.complete_upload(prepared.completion)
    assert reused.id == original.id
    assert reused.status == :active

    for field <- [:community_id, :public_ref, :storage, :storage_key] do
      assert Map.fetch!(reused, field) == Map.fetch!(original, field)
    end

    assert {:ok, replayed} = CMS.Assets.complete_upload(prepared.completion)
    assert replayed == reused
    assert Repo.get_by!(AssetUpload, upload_ref: prepared.intent.upload_ref).state == :completed
    key = prepared.attrs.storage_key

    assert Repo.aggregate(
             from(a in CommunityAsset, where: a.storage == "r2" and a.storage_key == ^key),
             :count
           ) == 1
  end

  test "an archived owner remains the same object on duplicate registration and normal Restore" do
    f = fixture()
    attrs = asset_attrs()
    assert {:ok, original} = register(f, attrs)

    assert {:ok, archived} =
             CMS.Assets.archive(f.community, original.id, f.actor, Ecto.UUID.generate())

    assert {:ok, reused} =
             register(
               f,
               Map.merge(attrs, %{
                 status: :active,
                 archived_at: nil,
                 deleted_at: nil,
                 meta: %{"updated" => true}
               })
             )

    assert reused.id == original.id
    assert reused.status == :archived
    assert reused.archived_at == archived.archived_at
    assert reused.public_ref == original.public_ref
    assert reused.storage_key == original.storage_key

    assert {:ok, restored} =
             CMS.Assets.restore(f.community, original.id, f.actor, Ecto.UUID.generate())

    assert restored.status == :active
    assert restored.storage_key == original.storage_key
    assert restored.public_ref == original.public_ref
  end

  for fault <- [:skip_insert, :constraint_error] do
    @fault fault
    test "#{fault} without a storage owner is a domain error with no successful Receipt or asset" do
      f = fixture()
      attrs = asset_attrs()
      before = facts()
      command_id = Ecto.UUID.generate()

      with_trigger(@fault, f.community.id, attrs.storage_key, fn ->
        assert_conflict(CMS.Assets.register_to_community(f.community, attrs, f.actor, command_id))
      end)

      assert facts() == before
      refute Repo.get_by(CommandReceipt, command_id: command_id)
    end
  end

  for scenario <- [:deleted_after_precheck, :foreign_after_precheck, :constraint_retry_deleted] do
    @scenario scenario
    @tag timeout: 60_000
    test "#{scenario} cannot adopt the object when an owner appears after an empty precheck" do
      with_committed_fixture(fn owner ->
        target =
          if @scenario == :foreign_after_precheck do
            fixture()
          else
            owner
          end

        entry = if @scenario == :foreign_after_precheck, do: :register, else: :application_upload
        prepared = prepare(entry, target)
        parent = self()
        handler = "provider-registration-#{Ecto.UUID.generate()}"
        storage_key = prepared.attrs.storage_key

        :telemetry.attach(
          handler,
          [:groupher_server, :repo, :query],
          fn _, _, metadata, _ ->
            if Process.get({__MODULE__, :candidate}) do
              query = Map.get(metadata, :query, "")
              result = Map.get(metadata, :result)

              if String.starts_with?(query, "SELECT") and
                   Map.get(metadata, :params) == ["r2", storage_key] and
                   match?({:ok, %{num_rows: 0}}, result) and
                   not Process.get({__MODULE__, :paused}, false) do
                Process.put({__MODULE__, :paused}, true)
                send(parent, {:empty_owner_precheck, self()})

                receive do
                  :continue_insert -> :ok
                after
                  10_000 -> raise "registration precheck barrier timed out"
                end
              end

              if String.starts_with?(query, "INSERT INTO \"cms\".\"community_assets\"") do
                case result do
                  {:ok, %{num_rows: 0}} ->
                    send(parent, {:insert_outcome, :no_row})

                  {:error,
                   %Postgrex.Error{postgres: %{constraint: "community_assets_storage_key_index"}}} ->
                    send(parent, {:insert_outcome, :constraint_error})

                  _ ->
                    :ok
                end
              end
            end
          end,
          nil
        )

        try do
          run = fn ->
            candidate =
              Task.async(fn ->
                Sandbox.unboxed_run(Repo, fn ->
                  Process.put({__MODULE__, :candidate}, true)

                  Repo.transact_result(fn ->
                    Repo.query!("SELECT set_config('test.asset_candidate', 'true', true)")
                    invoke(entry, target, prepared, Ecto.UUID.generate())
                  end)
                end)
              end)

            try do
              assert_receive {:empty_owner_precheck, writer}, 10_000

              assert {:ok, asset} =
                       register(owner, prepared.attrs)

              if @scenario != :foreign_after_precheck do
                assert {:ok, %{status: :deleted}} =
                         delete_asset(owner, asset)
              end

              original = Repo.get!(CommunityAsset, asset.id)
              before = facts()
              send(writer, :continue_insert)
              assert_conflict(Task.await(candidate, 15_000))

              expected =
                if @scenario == :constraint_retry_deleted, do: :constraint_error, else: :no_row

              assert_receive {:insert_outcome, ^expected}, 5_000
              assert Repo.get!(CommunityAsset, asset.id) == original
              assert facts() == before

              assert Repo.aggregate(
                       from(a in CommunityAsset,
                         where: a.storage == "r2" and a.storage_key == ^storage_key
                       ),
                       :count
                     ) == 1
            after
              Task.shutdown(candidate, :brutal_kill)
            end
          end

          if @scenario == :constraint_retry_deleted do
            with_trigger(:constraint_error, target.community.id, storage_key, run,
              candidate_only: true
            )
          else
            run.()
          end
        after
          :telemetry.detach(handler)

          if target.community.id != owner.community.id do
            destroy(target)
          end
        end
      end)
    end
  end

  test "same-content K2 completes as a new object and delivery of E retains K2's active identity" do
    f = fixture()
    first = prepare(:ordinary_upload, f)
    assert {:ok, original} = CMS.Assets.complete_upload(first.completion)
    assert {:ok, %{status: :deleted}} = delete_asset(f, original)

    event =
      Repo.one!(
        from(e in Event,
          where: e.event == "asset.provider_delete" and e.resource_id == ^to_string(original.id)
        )
      )

    second = prepare(:ordinary_upload, f)
    assert second.completion.content_hash == first.completion.content_hash
    refute second.intent.object_key == first.intent.object_key
    assert {:ok, replacement} = CMS.Assets.complete_upload(second.completion)
    replacement_before = Repo.get!(CommunityAsset, replacement.id)

    with_endpoint(fn ->
      assert {:ok, :pass} =
               GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
                 args: %{"event_id" => event.id},
                 attempt: 1,
                 max_attempts: 8
               })

      assert_receive {:provider_received, payload}, 5_000
      assert payload["storageKey"] == first.intent.object_key
      refute payload["storageKey"] == second.intent.object_key
      assert payload["assetId"] == original.id
      assert Repo.get!(Event, event.id).status == :done
    end)

    assert Repo.get!(CommunityAsset, original.id).status == :deleted
    assert Repo.get!(CommunityAsset, replacement.id) == replacement_before
    assert replacement_before.status == :active
    assert {:ok, _} = CMS.Assets.origin_info(replacement.public_ref)
    assert Repo.get_by!(AssetUpload, upload_ref: second.intent.upload_ref).state == :completed
  end

  defp fixture do
    {community, post, _, actor} = mock_article(:post)
    article = Repo.get!(Article, post.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id, scope_type: :default)
    assert {:ok, _} = CMS.Assets.backfill_usage(community)
    %{community: community, actor: actor, article: article, work: work}
  end

  defp asset_attrs do
    ref = Ecto.UUID.generate()

    %{
      public_ref: "asset_#{ref}",
      url: "https://assets.test/#{ref}.png",
      filename: "identity.png",
      mime_type: "image/png",
      size_bytes: 80,
      asset_type: :image,
      thread: :post,
      storage: "r2",
      storage_key: "provider-registration/#{ref}",
      meta: %{"original" => true}
    }
  end

  defp prepare(entry, f) when entry in [:ordinary_upload, :generated_upload] do
    file = %{filename: "identity.png", mime_type: "image/png", size_bytes: 80, thread: :post}

    file =
      if entry == :generated_upload do
        Map.merge(file, %{
          filename: "identity.webp",
          mime_type: "image/webp",
          width: 32,
          height: 32,
          batch_ref: "batch_#{Ecto.UUID.generate()}",
          candidate_owner_ref: "candidate_test",
          variant_key: "default"
        })
      else
        file
      end

    result =
      if entry == :generated_upload do
        CMS.Assets.create_generated_upload_intent(f.community, file, f.actor)
      else
        CMS.Assets.create_upload_intent(f.community, file, f.actor)
      end

    assert {:ok, intent} = result
    upload = Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref)

    completion = %{
      upload_ref: intent.upload_ref,
      idempotency_key: intent.upload_ref,
      asset_public_ref: intent.asset_public_ref,
      community_id: f.community.id,
      content_hash: "sha256:same-content",
      filename: file.filename,
      mime_type: file.mime_type,
      asset_type: :image,
      size_bytes: 80,
      storage: "r2",
      storage_key: intent.object_key,
      url: upload.canonical_url,
      thread: :post,
      uploader_id: f.actor.id,
      width: 32,
      height: 32,
      meta: %{"attempted" => true}
    }

    attrs =
      completion
      |> Map.drop([:upload_ref, :idempotency_key, :asset_public_ref])
      |> Map.put(:public_ref, intent.asset_public_ref)

    %{intent: intent, completion: completion, attrs: attrs}
  end

  defp prepare(:application_upload, f) do
    attrs = asset_attrs()

    upload =
      Repo.insert!(
        CommunityApplicationLogoUpload.changeset(%CommunityApplicationLogoUpload{}, %{
          public_ref: "upload_#{Ecto.UUID.generate()}",
          user_id: f.actor.id,
          filename: attrs.filename,
          mime_type: attrs.mime_type,
          size_bytes: 80,
          status: :finalized,
          expires_at: DateTime.add(DateTime.utc_now(:second), 3600, :second),
          finalized_at: DateTime.utc_now(:second),
          url: attrs.url,
          storage: "r2",
          storage_key: attrs.storage_key
        })
      )

    %{attrs: attrs, upload: upload}
  end

  defp prepare(_entry, _f), do: %{attrs: asset_attrs()}

  defp invoke(:register, f, p, command_id) do
    attrs =
      Map.merge(p.attrs, %{
        public_ref: "asset_attempt_#{Ecto.UUID.generate()}",
        meta: %{"attempted" => true}
      })

    CMS.Assets.register_to_community(f.community, attrs, f.actor, command_id)
  end

  defp invoke(entry, _f, p, _id) when entry in [:ordinary_upload, :generated_upload] do
    CMS.Assets.complete_upload(p.completion)
  end

  defp invoke(:application_upload, f, p, _id) do
    CMS.Assets.register_from_application_upload(f.community, p.upload, f.actor)
  end

  defp invoke(:article_cover, f, p, command_id) do
    CMS.Articles.save_working_copy(
      f.article,
      f.community,
      f.work.id,
      %{cover_asset: Map.put(p.attrs, :meta, %{"attempted" => true})},
      f.work.revision,
      f.actor,
      command_id
    )
  end

  defp register(f, attrs) do
    CMS.Assets.register_to_community(f.community, attrs, f.actor, Ecto.UUID.generate())
  end

  defp delete_asset(f, asset) do
    CMS.Assets.delete(f.community, asset.id, f.actor, Ecto.UUID.generate())
  end

  defp assert_conflict(result) do
    assert {:error, %{code: 5607, reason: :storage_identity_conflict}} = result
  end

  defp assert_entry_failure(entry, f, %{intent: intent} = prepared, command_id, before)
       when entry in [:ordinary_upload, :generated_upload] do
    upload = Repo.get_by!(AssetUpload, upload_ref: intent.upload_ref)
    assert upload.state == :failed
    assert upload.failure_code == "completion_rejected"
    assert upload.asset_id == nil
    assert upload.completed_at == nil
    assert upload.completion == %{}
    assert upload.callback_attempts == 1
    assert {:error, _} = invoke(entry, f, prepared, command_id)
    assert Repo.get!(AssetUpload, upload.id) == upload
    assert facts() == before
  end

  defp assert_entry_failure(:application_upload, _f, %{upload: upload}, _command_id, _before) do
    assert Repo.get!(CommunityApplicationLogoUpload, upload.id) == upload
  end

  defp assert_entry_failure(_entry, _f, _prepared, _command_id, _before), do: :ok

  defp facts do
    %{
      assets: Repo.all(from(a in CommunityAsset, order_by: a.id)),
      events: Repo.all(from(e in Event, order_by: e.id)),
      jobs: Repo.all(from(j in Oban.Job, order_by: j.id)),
      retries: Repo.all(from(r in Retry, order_by: r.id)),
      receipts: Repo.all(from(r in CommandReceipt, order_by: r.id)),
      refs: Repo.all(from(r in ArticleAssetRef, order_by: r.id)),
      works: Repo.all(from(w in ArticleWorkingCopy, order_by: w.id)),
      histories: Repo.all(from(e in ArticleEvent, order_by: e.id))
    }
  end

  defp with_trigger(fault, community_id, storage_key, action, options \\ []) do
    suffix = Ecto.UUID.generate() |> String.replace("-", "") |> String.slice(0, 12)
    name = "test_asset_conflict_#{suffix}"
    # Fixtures use generated UUID paths; SQL identifiers and literals contain no external input.
    statement =
      case fault do
        :skip_insert ->
          "RETURN NULL;"

        :constraint_error ->
          "RAISE unique_violation USING CONSTRAINT = 'community_assets_storage_key_index', MESSAGE = 'injected storage conflict';"
      end

    role_guard =
      if Keyword.get(options, :candidate_only, false) do
        " AND current_setting('test.asset_candidate', true) = 'true'"
      else
        ""
      end

    Repo.query!(
      "CREATE FUNCTION cms.#{name}() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.community_id = #{community_id} AND NEW.storage_key = '#{storage_key}'#{role_guard} THEN #{statement} END IF; RETURN NEW; END $body$"
    )

    Repo.query!(
      "CREATE TRIGGER #{name} BEFORE INSERT ON cms.community_assets FOR EACH ROW EXECUTE FUNCTION cms.#{name}()"
    )

    try do
      action.()
    after
      Repo.query!("DROP TRIGGER IF EXISTS #{name} ON cms.community_assets")
      Repo.query!("DROP FUNCTION IF EXISTS cms.#{name}()")
    end
  end

  defp with_committed_fixture(action) do
    # The main thread has no outer transaction. Its reads must not retain a
    # Sandbox table lock while committed fault DDL is dropped.
    Sandbox.unboxed_run(Repo, fn ->
      initial = baseline()
      f = fixture()

      try do
        action.(f)
      after
        destroy(f)
        current = baseline()
        new_events = current.events -- initial.events
        Repo.delete_all(from(j in Oban.Job, where: j.id in ^(current.jobs -- initial.jobs)))
        Repo.delete_all(from(r in Retry, where: r.event_id in ^new_events))
        Repo.delete_all(from(e in Event, where: e.id in ^new_events))

        Repo.delete_all(
          from(r in CommandReceipt, where: r.id in ^(current.receipts -- initial.receipts))
        )
      end
    end)
  end

  defp baseline do
    %{
      events: Repo.all(from(e in Event, select: e.id)),
      jobs: Repo.all(from(j in Oban.Job, select: j.id)),
      receipts: Repo.all(from(r in CommandReceipt, select: r.id))
    }
  end

  defp destroy(f) do
    assert {:ok, _} =
             CMS.Communities.Lifecycle.request_destroy(f.community.id,
               recover_until: DateTime.add(DateTime.utc_now(:second), -1, :second),
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.schedule_destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )

    assert {:ok, _} =
             CMS.Communities.Lifecycle.destroy(f.community.id,
               operation_ref: Ecto.UUID.generate()
             )
  end

  defp with_endpoint(action) do
    ref = Module.concat(__MODULE__, "Endpoint#{System.unique_integer([:positive])}")
    {:ok, _} = Plug.Cowboy.http(Endpoint, [parent: self()], port: 0, ref: ref)
    previous = System.get_env("ASSETS_HUB_DELETE_ENDPOINT")
    key = {"https://assets.groupher.com/internal", ["assets:object:delete"]}
    tokens = :ets.lookup(:groupher_service_token_cache, key)
    System.put_env("ASSETS_HUB_DELETE_ENDPOINT", "http://127.0.0.1:#{:ranch.get_port(ref)}")

    :ets.insert(
      :groupher_service_token_cache,
      {key, "test-service-token", System.system_time(:second) + 3600}
    )

    try do
      action.()
    after
      Plug.Cowboy.shutdown(ref)

      if previous do
        System.put_env("ASSETS_HUB_DELETE_ENDPOINT", previous)
      else
        System.delete_env("ASSETS_HUB_DELETE_ENDPOINT")
      end

      :ets.delete(:groupher_service_token_cache, key)
      Enum.each(tokens, &:ets.insert(:groupher_service_token_cache, &1))
    end
  end
end
