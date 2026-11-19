defmodule GroupherServer.Test.CMS.OutboxRecoveryConcurrencyTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.CMS
  alias CMS.Model.{AssetWorkflowRun, AssetWorkflowStep, Community, CommunityAsset, GlobalPassport}
  alias CMS.Outbox.{Event, Retry}

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    :ok
  end

  @tag timeout: 60_000
  test "manual and leased provider recovery compete for one generation and record the actual winner" do
    {:ok, fixture} =
      Sandbox.unboxed_run(Repo, fn ->
        Repo.transact_result(fn ->
          {:ok, root} =
            db_insert(:user, %{
              login:
                "recovery-" <> Base.url_encode64(:crypto.strong_rand_bytes(9), padding: false)
            })

          Repo.insert!(
            GlobalPassport.changeset(%GlobalPassport{}, %{user_id: root.id, is_root: true})
          )

          ref = Ecto.UUID.generate()

          community =
            Repo.insert!(
              Community.changeset(%Community{}, %{
                user_id: root.id,
                title: "Recovery race",
                slug: "recovery-#{String.slice(ref, 0, 20)}",
                desc: "Isolated recovery fixture",
                logo: "https://assets.test/logo.png"
              })
            )

          asset =
            Repo.insert!(
              CommunityAsset.changeset(%CommunityAsset{}, %{
                community_id: community.id,
                url: "https://assets.test/#{ref}",
                size_bytes: 1,
                storage: "r2",
                storage_key: "recovery-race/#{ref}",
                public_ref: "asset_#{ref}",
                status: :deleted,
                deleted_at: DateTime.utc_now(:second)
              })
            )

          {:ok, event} = CMS.Assets.Effects.enqueue_provider_delete(asset, Ecto.UUID.generate())

          assert {:error, _} =
                   CMS.Outbox.execute(
                     event.id,
                     fn _ ->
                       {:error, CMS.Assets.ErrorCat.delete_enqueue_failed(%{status: 503})}
                     end,
                     on_error: :fail
                   )

          {:ok,
           %{
             community: community,
             root: root,
             asset: asset,
             event: Repo.get!(Event, event.id),
             workflow_ref: "provider-race:#{ref}"
           }}
        end)
      end)

    on_exit(fn -> cleanup(fixture) end)
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)
    parent = self()

    try do
      manual =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, {:ready, self()})

            receive do
              :go -> :ok
            end

            CMS.retry_outbox_event(
              fixture.event.id,
              1,
              fixture.root,
              "provider incident resolved"
            )
          end)
        end)

      owner =
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, {:ready, self()})

            receive do
              :go -> :ok
            end

            CMS.Assets.ProviderReconciliation.enqueue_missing(fixture.community,
              workflow_ref: fixture.workflow_ref,
              age_seconds: 0
            )
          end)
        end)

      assert_receive {:ready, first}, 5_000
      assert_receive {:ready, second}, 5_000
      send(first, :go)
      send(second, :go)
      assert {:ok, %{outcome: outcome}} = Task.await(manual, 15_000)
      assert outcome in [:requeued, :already_retried]
      assert {:ok, %{status: :completed}} = Task.await(owner, 15_000)

      Sandbox.unboxed_run(Repo, fn ->
        assert [retry] = Repo.all(from(row in Retry, where: row.event_id == ^fixture.event.id))

        assert Repo.aggregate(
                 from(job in Oban.Job,
                   where: job.args["event_id"] == ^fixture.event.id
                 ),
                 :count
               ) == 1

        current = Repo.get!(Event, fixture.event.id)
        assert current.status == :waiting
        assert current.failure_generation == 1
        assert current.operation_ref == fixture.event.operation_ref
        assert current.dedupe_key == fixture.event.dedupe_key
        assert current.data == fixture.event.data
        assert retry.original_operation_ref == fixture.event.operation_ref
        refute retry.retry_operation_ref == retry.original_operation_ref

        case retry.initiator_kind do
          "user" ->
            assert retry.actor_id == fixture.root.id
            assert retry.reason == "provider incident resolved"
            assert retry.owner_ref == nil

          "owner" ->
            run = Repo.get_by!(AssetWorkflowRun, workflow_ref: fixture.workflow_ref)
            step = Repo.get_by!(AssetWorkflowStep, run_id: run.id)
            assert step.status == :succeeded
            assert retry.retry_operation_ref == step.operation_ref
            assert retry.owner_ref == "provider-reconciliation:#{fixture.workflow_ref}"
            assert retry.reason_code == "provider_delete_retry"
            assert retry.actor_id == nil
        end
      end)
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end

  defp cleanup(fixture) do
    Sandbox.unboxed_run(Repo, fn ->
      Repo.delete_all(from(job in Oban.Job, where: job.args["event_id"] == ^fixture.event.id))
      Repo.delete_all(from(retry in Retry, where: retry.event_id == ^fixture.event.id))
      Repo.delete_all(from(event in Event, where: event.id == ^fixture.event.id))
      run = Repo.get_by(AssetWorkflowRun, workflow_ref: fixture.workflow_ref)

      if run do
        Repo.delete_all(from(step in AssetWorkflowStep, where: step.run_id == ^run.id))
        Repo.delete!(run)
      end

      Repo.delete!(Repo.get!(CommunityAsset, fixture.asset.id))
      Repo.delete!(Repo.get!(Community, fixture.community.id))

      Repo.delete_all(
        from(passport in GlobalPassport, where: passport.user_id == ^fixture.root.id)
      )

      # Account deletion is prohibited; the task-owned test database retains this user.
    end)
  end
end
