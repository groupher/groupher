defmodule GroupherServer.Test.CMS.Assets.ProviderFailureTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Assets.Deletion
  alias CMS.Model.CommunityAsset
  alias CMS.Outbox.{Event, Retry}

  defmodule Endpoint do
    @moduledoc false
    import Plug.Conn
    def init(options), do: options

    def call(conn, _options) do
      {:ok, body, conn} = read_body(conn)

      send(
        Application.fetch_env!(:groupher_server, :provider_failure_test_pid),
        {:provider_request, Jason.decode!(body)}
      )

      status = Application.fetch_env!(:groupher_server, :provider_failure_test_status)

      response =
        if status in 200..299 do
          ~s({"ok":true,"result":{"enqueued":true}})
        else
          ~s({"accepted":false})
        end

      conn
      |> put_resp_content_type("application/json")
      |> send_resp(status, response)
    end
  end

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {:ok, community} = db_insert(:community)
    %{community: community}
  end

  test "permanent HTTP rejection becomes dead on the first delivery and never means object absence",
       ctx do
    with_endpoint(fn ->
      for status <- [400, 401, 403, 404, 409, 422] do
        Application.put_env(:groupher_server, :provider_failure_test_status, status)
        {asset, event} = intent(ctx.community)
        assert {:ok, :pass} = perform(event)
        assert_receive {:provider_request, %{"assetId" => id}}
        assert id == asset.id
        current = Repo.get!(Event, event.id)
        assert current.status == :failed
        assert current.last_error_code == "5608"
        assert current.failure_generation == 1
        assert current.attempts == 1
        assert current.completed_at == nil
      end
    end)
  end

  test "a rejected deletion cannot be reset by a later provider reconciliation run", ctx do
    with_endpoint(fn ->
      Application.put_env(:groupher_server, :provider_failure_test_status, 403)
      {_asset, event} = intent(ctx.community)
      assert {:ok, :pass} = perform(event)
      original = Repo.get!(Event, event.id)
      previous = Application.get_env(:groupher_server, :env)
      Application.put_env(:groupher_server, :env, :dev)

      try do
        assert {:error, :provider_delete_event_not_recoverable} =
                 CMS.Assets.reconcile_provider_deletions(ctx.community,
                   workflow_ref: "permanent:#{Ecto.UUID.generate()}",
                   age_seconds: -1
                 )
      after
        Application.put_env(:groupher_server, :env, previous)
      end

      assert Repo.get!(Event, event.id) == original
      refute Repo.exists?(from(retry in Retry, where: retry.event_id == ^event.id))
      refute Repo.exists?(from(job in Oban.Job, where: job.args["event_id"] == ^event.id))
    end)
  end

  test "rate limiting and temporary provider errors keep their retryable category", ctx do
    with_endpoint(fn ->
      for status <- [429, 503] do
        Application.put_env(:groupher_server, :provider_failure_test_status, status)
        {_asset, event} = intent(ctx.community)
        assert {:error, %{code: 5603, retryable: true}} = perform(event)
        current = Repo.get!(Event, event.id)
        assert current.status == :retrying
        assert current.failure_generation == 0
        assert current.last_error_code == "5603"
        assert current.completed_at == nil
      end
    end)
  end

  test "missing endpoint configuration is permanent and cannot masquerade as a transient provider failure",
       ctx do
    previous = System.get_env("ASSETS_HUB_DELETE_ENDPOINT")
    System.delete_env("ASSETS_HUB_DELETE_ENDPOINT")

    try do
      {_asset, event} = intent(ctx.community)
      assert {:ok, :pass} = perform(event)
      current = Repo.get!(Event, event.id)
      assert current.status == :failed
      assert current.last_error_code == "5610"
      assert current.completed_at == nil
    after
      restore_endpoint(previous)
    end
  end

  test "known transport failures are retryable while unknown values and error text fail closed" do
    for reason <- [
          :timeout,
          %{reason: :econnreset},
          {:failed_connect, [{:inet, [:inet], :econnrefused}]}
        ] do
      assert {:error, %{code: 5603, retryable: true}} = Deletion.transport_failure(reason)
    end

    for reason <- [
          :unclassified,
          "provider status 503",
          {:failed_connect, [{:ssl, [], :unknown_ca}]}
        ] do
      assert {:error, %{code: 5609, retryable: false}} = Deletion.transport_failure(reason)
    end
  end

  test "the real worker rejects each invalid deletion target on its first attempt without HTTP",
       ctx do
    with_endpoint(fn ->
      Application.put_env(:groupher_server, :provider_failure_test_status, 200)

      mutations = [
        fn asset -> Repo.update!(Ecto.Changeset.change(asset, status: :active)) end,
        fn asset -> Repo.update!(Ecto.Changeset.change(asset, status: :archived)) end,
        fn asset -> Repo.update!(Ecto.Changeset.change(asset, deleted_at: nil)) end,
        fn asset ->
          Repo.update!(Ecto.Changeset.change(asset, public_ref: "other-" <> asset.public_ref))
        end,
        fn asset -> Repo.update!(Ecto.Changeset.change(asset, storage: "other-provider")) end,
        fn asset ->
          Repo.update!(Ecto.Changeset.change(asset, storage_key: "other/" <> asset.storage_key))
        end,
        fn asset -> Repo.delete!(asset) end
      ]

      for mutate <- mutations do
        {asset, event} = intent(ctx.community)
        mutate.(asset)
        canonical = Repo.get(CommunityAsset, asset.id)
        assert_permanent_guard(event)
        assert Repo.get(CommunityAsset, asset.id) == canonical
      end

      refute_received {:provider_request, _payload}
    end)
  end

  test "malformed frozen provider identity is never filled from the current asset", ctx do
    with_endpoint(fn ->
      Application.put_env(:groupher_server, :provider_failure_test_status, 200)

      for field <- ["asset_id", "public_ref", "storage", "storage_key"] do
        {asset, event} = intent(ctx.community)
        malformed = Repo.update!(Event.changeset(event, %{data: Map.delete(event.data, field)}))
        assert_permanent_guard(malformed)
        assert Repo.get!(CommunityAsset, asset.id) == asset
      end

      refute_received {:provider_request, _payload}
    end)
  end

  test "an explicit nullable public ref differs from a missing frozen field", ctx do
    with_endpoint(fn ->
      Application.put_env(:groupher_server, :provider_failure_test_status, 200)
      {_asset, valid} = intent(ctx.community, public_ref: nil)
      assert Map.has_key?(valid.data, "public_ref")
      assert valid.data["public_ref"] == nil
      assert {:ok, :pass} = perform(valid)
      assert_receive {:provider_request, payload}
      assert Map.has_key?(payload, "assetPublicRef")
      assert payload["assetPublicRef"] == nil
      assert Repo.get!(Event, valid.id).status == :done

      {asset, event} = intent(ctx.community, public_ref: nil)

      malformed =
        Repo.update!(Event.changeset(event, %{data: Map.delete(event.data, "public_ref")}))

      assert_permanent_guard(malformed)
      assert Repo.get!(CommunityAsset, asset.id) == asset
      refute_received {:provider_request, _payload}
    end)
  end

  defp assert_permanent_guard(event) do
    retries = Repo.all(Retry)
    assert {:ok, :pass} = perform(event)
    failed = Repo.get!(Event, event.id)
    assert failed.status == :failed
    assert failed.last_error_code == "5605"
    assert failed.failure_generation == 1
    assert failed.attempts == 1
    assert failed.completed_at == nil

    for key <- [:id, :operation_ref, :dedupe_key, :data] do
      assert Map.fetch!(failed, key) == Map.fetch!(event, key)
    end

    assert Repo.all(Retry) == retries
  end

  defp intent(community, opts \\ []) do
    ref = Ecto.UUID.generate()

    asset =
      Repo.insert!(
        CommunityAsset.changeset(%CommunityAsset{}, %{
          community_id: community.id,
          url: "https://assets.test/#{ref}",
          size_bytes: 1,
          storage: "r2",
          storage_key: "provider-errors/#{ref}",
          public_ref: Keyword.get(opts, :public_ref, "asset_#{ref}"),
          status: :deleted,
          deleted_at: DateTime.utc_now(:second)
        })
      )

    {:ok, event} =
      Repo.transact_result(fn ->
        CMS.Assets.Effects.enqueue_provider_delete(asset, Ecto.UUID.generate())
      end)

    {asset, event}
  end

  defp perform(event) do
    GroupherServer.Jobs.CMSOutboxAsset.perform(%Oban.Job{
      args: %{"event_id" => event.id},
      attempt: 1,
      max_attempts: 8
    })
  end

  defp with_endpoint(action) do
    ref = Module.concat(__MODULE__, "Endpoint#{System.unique_integer([:positive])}")
    {:ok, _pid} = Plug.Cowboy.http(Endpoint, [], port: 0, ref: ref)
    previous_endpoint = System.get_env("ASSETS_HUB_DELETE_ENDPOINT")
    previous_pid = Application.get_env(:groupher_server, :provider_failure_test_pid)
    previous_status = Application.get_env(:groupher_server, :provider_failure_test_status)
    key = {"https://assets.groupher.com/internal", ["assets:object:delete"]}
    previous_token = :ets.lookup(:groupher_service_token_cache, key)
    System.put_env("ASSETS_HUB_DELETE_ENDPOINT", "http://127.0.0.1:#{:ranch.get_port(ref)}")
    Application.put_env(:groupher_server, :provider_failure_test_pid, self())

    :ets.insert(
      :groupher_service_token_cache,
      {key, "test-service-token", System.system_time(:second) + 3600}
    )

    try do
      action.()
    after
      Plug.Cowboy.shutdown(ref)
      restore_endpoint(previous_endpoint)
      restore_app(:provider_failure_test_pid, previous_pid)
      restore_app(:provider_failure_test_status, previous_status)
      :ets.delete(:groupher_service_token_cache, key)
      Enum.each(previous_token, &:ets.insert(:groupher_service_token_cache, &1))
    end
  end

  defp restore_endpoint(nil), do: System.delete_env("ASSETS_HUB_DELETE_ENDPOINT")
  defp restore_endpoint(value), do: System.put_env("ASSETS_HUB_DELETE_ENDPOINT", value)
  defp restore_app(key, nil), do: Application.delete_env(:groupher_server, key)
  defp restore_app(key, value), do: Application.put_env(:groupher_server, key, value)
end
