# Run only after B0 DDL against an explicitly named disposable test database.
import ExUnit.Assertions
import Ecto.Query
import GroupherServer.Support.Factory

alias Ecto.Adapters.SQL.Sandbox
alias GroupherServer.{CMS, Repo}
alias CMS.DocTree.Publish.Queue
alias CMS.Model.DocsPublishQueue

[[database]] = Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "Queue state exercise requires an explicitly named disposable test database"
end

{:ok, site} = db_insert(:community)
{:ok, rollback_site} = db_insert(:community)

assert {:ok, %DocsPublishQueue{id: nil, tree_lock_version: 0, queue_revision: 0}} =
         Queue.read(site)

assert {:error, :transaction_required} = Queue.lock_or_create(site)

assert {:ok, :verified} =
         Repo.transaction(fn ->
           assert {:ok, queue} = Queue.lock_or_create(site)
           assert queue.tree_lock_version == 0
           assert queue.public_presentation_revision == 0

           assert {:ok, advanced} =
                    Queue.advance(site, queue, %{tree_lock_version: 0}, [:tree_lock_version])

           assert advanced.tree_lock_version == 1
           assert advanced.queue_revision == 0
           assert advanced.public_presentation_revision == 0
           assert advanced.approval_policy_revision == 0

           assert {:ok, unchanged} = Queue.advance(site, queue, %{tree_lock_version: 1}, [])
           assert unchanged.updated_at == advanced.updated_at

           assert {:error, {:queue_version_conflict, :tree_lock_version, 1}} =
                    Queue.advance(site, queue, %{tree_lock_version: 0}, [:tree_lock_version])

           assert {:error, :invalid_queue_versions} =
                    Queue.advance(site, queue, %{tree_lock_version: 1}, [
                      :queue_revision
                    ])

           assert {:ok, both} =
                    Queue.advance(
                      site,
                      queue,
                      %{tree_lock_version: 1, queue_revision: 0},
                      [:tree_lock_version, :queue_revision]
                    )

           assert {both.tree_lock_version, both.queue_revision} == {2, 1}

           assert {:ok, %{queue: same, changed?: false}} =
                    Queue.set_policy(site, queue, 0, false, false)

           assert same.approval_policy_revision == 0

           assert {:ok, %{queue: policy, changed?: true}} =
                    Queue.set_policy(site, queue, 0, true, false)

           assert policy.approval_policy_revision == 1
           assert policy.approval_required
           assert {policy.tree_lock_version, policy.queue_revision} == {2, 1}

           assert {:error, {:queue_version_conflict, :approval_policy_revision, 1}} =
                    Queue.set_policy(site, queue, 0, false, true)

           assert {:error, :invalid_queue_versions} =
                    Queue.advance(site, queue, %{approval_policy_revision: 1}, [
                      :approval_policy_revision
                    ])

           :verified
         end)

assert {:error, :expected_rollback} =
         Repo.transaction(fn ->
           assert {:ok, queue} = Queue.lock_or_create(rollback_site)

           assert {:ok, advanced} =
                    Queue.advance(rollback_site, queue, %{tree_lock_version: 0}, [
                      :tree_lock_version
                    ])

           assert {advanced.tree_lock_version, advanced.queue_revision,
                   advanced.public_presentation_revision} == {1, 0, 0}

           Repo.rollback(:expected_rollback)
         end)

assert {:ok,
        %DocsPublishQueue{
          id: nil,
          tree_lock_version: 0,
          queue_revision: 0,
          public_presentation_revision: 0,
          approval_policy_revision: 0,
          approval_required: false,
          allow_self_approval: false,
          public_release_id: nil,
          latest_approval_id: nil
        }} = Queue.read(rollback_site)

assert {:ok, persisted} = Queue.read(site)

assert {:error, :transaction_required} =
         Queue.advance(site, persisted, %{tree_lock_version: 2}, [:tree_lock_version])

assert {:error, :overflow_checked} =
         Repo.transaction(fn ->
           {1, nil} =
             Repo.update_all(
               from(queue in DocsPublishQueue, where: queue.id == ^persisted.id),
               set: [queue_revision: 9_223_372_036_854_775_807]
             )

           assert {:error, :queue_version_exhausted} =
                    Queue.advance(
                      site,
                      persisted,
                      %{queue_revision: 9_223_372_036_854_775_807},
                      [:queue_revision]
                    )

           Repo.rollback(:overflow_checked)
         end)

parent = self()

for first_rolls_back? <- [false, true] do
  {:ok, concurrent_site} = db_insert(:community)

  first =
    Task.async(fn ->
      Sandbox.unboxed_run(Repo, fn ->
        Repo.transaction(fn ->
          assert {:ok, queue} = Queue.lock_or_create(concurrent_site)
          send(parent, {:first_ready, self(), queue.id})

          receive do
            :finish ->
              if first_rolls_back?, do: Repo.rollback(:expected_first_rollback), else: queue.id
          after
            10_000 -> Repo.rollback(:barrier_timeout)
          end
        end)
      end)
    end)

  assert_receive {:first_ready, first_pid, first_id}, 10_000

  second =
    Task.async(fn ->
      Sandbox.unboxed_run(Repo, fn ->
        Repo.transaction(fn ->
          send(parent, :second_attempting)
          assert {:ok, queue} = Queue.lock_or_create(concurrent_site)
          queue.id
        end)
      end)
    end)

  assert_receive :second_attempting, 10_000
  assert Task.yield(second, 100) == nil
  send(first_pid, :finish)
  first_result = Task.await(first, 10_000)
  assert {:ok, second_id} = Task.await(second, 10_000)

  if first_rolls_back? do
    assert {:error, :expected_first_rollback} = first_result
    refute second_id == first_id
  else
    assert {:ok, ^first_id} = first_result
    assert second_id == first_id
  end

  assert {:ok, %DocsPublishQueue{id: ^second_id}} = Queue.read(concurrent_site)
end

IO.puts("Docs Queue initialization and version exercise passed")
