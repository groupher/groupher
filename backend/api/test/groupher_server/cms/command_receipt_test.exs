defmodule GroupherServer.Test.CMS.CommandReceiptTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS.CommandReceipt
  alias GroupherServer.CMS.CommandReceipt.Store
  alias GroupherServer.CMS.DocTree.CommandReplay
  alias GroupherServer.CMS.Model.CommandReceipt, as: CommandReceiptModel

  test "replays the same user command and rejects a different fingerprint" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               {:ok, :new, receipt} =
                 Store.claim(
                   :user,
                   Integer.to_string(user.id),
                   command_key,
                   "article.update",
                   "post",
                   post.id,
                   %{body: "first"}
                 )

               {:ok, :new, receipt}
             end)

    assert {:ok, {:ok, :replay, replayed}} =
             Repo.transaction(fn ->
               Store.claim(
                 :user,
                 Integer.to_string(user.id),
                 command_key,
                 "article.update",
                 "post",
                 post.id,
                 %{body: "first"}
               )
             end)

    assert replayed.id == receipt.id

    assert {:ok, {:error, %GroupherServer.ErrorCat.Error{reason: :command_key_conflict}}} =
             Repo.transaction(fn ->
               Store.claim(
                 :user,
                 Integer.to_string(user.id),
                 command_key,
                 "article.update",
                 "post",
                 post.id,
                 %{body: "different"}
               )
             end)
  end

  test "failed transaction rolls back the receipt claim" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    assert {:error, :denied} =
             Repo.transaction(fn ->
               {:ok, :new, _receipt} =
                 Store.claim(
                   :user,
                   Integer.to_string(user.id),
                   command_key,
                   "article.delete",
                   "post",
                   post.id
                 )

               Repo.rollback(:denied)
             end)

    refute Repo.exists?(
             from(receipt in CommandReceiptModel,
               where:
                 receipt.initiator_type == "user" and
                   receipt.initiator_key == ^to_string(user.id) and
                   receipt.command_key == ^command_key
             )
           )
  end

  test "store returns validation failures without relabeling them as command conflicts" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, {:error, %Ecto.Changeset{} = changeset}} =
             Repo.transaction(fn ->
               Store.claim(
                 :user,
                 Integer.to_string(user.id),
                 "not-a-uuid",
                 "article.update",
                 "post",
                 post.id
               )
             end)

    assert Keyword.has_key?(changeset.errors, :command_key)
  end

  test "runs and replays a user command with a composite string target" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    assert {:ok, %{command_key: ^command_key, command_replayed: false}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "article.update_draft",
               "article",
               "community:post:article-key",
               %{expected_version: 3, title: "first"},
               fn -> {:ok, %{id: "article-key"}} end,
               fn _receipt -> {:ok, %{id: "article-key"}} end
             )

    assert {:ok, %{command_key: ^command_key, command_replayed: true}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "article.update_draft",
               "article",
               "community:post:article-key",
               %{expected_version: 3, title: "first"},
               fn -> {:error, :must_not_execute_on_replay} end,
               fn _receipt -> {:ok, %{id: "article-key"}} end
             )
  end

  test "a nil command key cannot bypass the receipt boundary" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :command_key_required}} =
             CommandReceipt.run_user_command(
               user,
               nil,
               "article.update",
               "post",
               "1",
               %{},
               fn -> {:ok, %{id: "post-1"}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )
  end

  test "invalid command keys fail closed before entering the receipt transaction" do
    {_community, _post, _attrs, user} = mock_article(:post)

    for command_key <- [42, false, [], %{}, "", "not-a-uuid"] do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :command_key_required}} =
               CommandReceipt.run_user_command(
                 user,
                 command_key,
                 "article.update",
                 "post",
                 "1",
                 %{},
                 fn -> {:ok, %{id: "post-1"}} end,
                 fn _receipt -> {:ok, %{id: "post-1"}} end
               )
    end

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :command_key_required}} =
             CommandReceipt.resolve_command_key(%{command_key: ""})
  end

  test "invalid callbacks remain programming errors instead of command key errors" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert_raise ArgumentError,
                 "command receipt callbacks must be execute/0 and replay/1 functions",
                 fn ->
                   CommandReceipt.run_user_command(
                     user,
                     Ecto.UUID.generate(),
                     "article.update",
                     "post",
                     "1",
                     %{},
                     :not_an_execute_callback,
                     fn _receipt -> {:ok, %{id: "post-1"}} end
                   )
                 end
  end

  test "internal command key resolution preserves retries and creates one-shot keys" do
    command_key = Ecto.UUID.generate()

    assert {:ok, ^command_key} = CommandReceipt.resolve_command_key(command_key)

    assert {:ok, ^command_key} =
             CommandReceipt.resolve_command_key(%{"command_key" => command_key})

    assert {:ok, ^command_key} =
             CommandReceipt.resolve_command_key([command_key: nil], %{command_key: command_key})

    assert {:ok, ^command_key} =
             CommandReceipt.resolve_command_key(%{}, %{command_key: command_key})

    assert {:ok, generated} = CommandReceipt.resolve_command_key(nil)
    assert {:ok, ^generated} = Ecto.UUID.cast(generated)

    assert {:ok, generated_from_map} = CommandReceipt.resolve_command_key(%{})
    assert {:ok, ^generated_from_map} = Ecto.UUID.cast(generated_from_map)
  end

  test "an invalid primary command key fails closed without consulting fallback" do
    fallback = %{command_key: Ecto.UUID.generate()}

    for primary <- [%{command_key: ""}, [command_key: ""], [:not_a_keyword_list]] do
      assert {:error, %GroupherServer.ErrorCat.Error{reason: :command_key_required}} =
               CommandReceipt.resolve_command_key(primary, fallback)
    end
  end

  test "unchanged outcomes are replayable completed commands" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    assert {:ok, %{command_replayed: false}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "upvote_remove",
               "post",
               "1",
               nil,
               fn -> {:ok, %{id: "post-1"}, %{outcome: :unchanged}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )

    assert Repo.get_by(CommandReceiptModel,
             initiator_type: "user",
             initiator_key: to_string(user.id),
             command_key: command_key
           ).outcome == "unchanged"

    assert {:ok, %{command_replayed: true}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "upvote_remove",
               "post",
               "1",
               nil,
               fn -> {:error, :must_not_execute_on_replay} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )
  end

  test "persists a versioned replay payload for tree-shaped results" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    result = %{
      revision: 4,
      tree_state: %{has_unpublished_changes: true},
      node: %{id: "page-1", type: :page},
      affected_nodes: [%{id: "page-1", type: :page}],
      conflict: false
    }

    assert {:ok, %{command_replayed: false}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "doc.tree.update_node",
               "doc_tree",
               "community:1:page-1",
               %{base_revision: 3, title: "Intro"},
               fn -> {:ok, result, CommandReplay.tree_metadata(result, "community:1:page-1")} end,
               fn receipt ->
                 assert receipt.result_payload["schema_version"] == 1
                 assert receipt.result_payload["node"]["type"] == "page"
                 {:ok, result}
               end
             )

    assert {:ok, %{command_replayed: true}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "doc.tree.update_node",
               "doc_tree",
               "community:1:page-1",
               %{base_revision: 3, title: "Intro"},
               fn -> {:error, :must_not_execute_on_replay} end,
               fn receipt ->
                 assert receipt.result_payload["affected_nodes"] != []
                 {:ok, result}
               end
             )
  end

  test "failed command execution rolls back its receipt claim" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()

    assert {:error, :denied} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "article.delete",
               "post",
               post.id,
               nil,
               fn -> {:error, :denied} end,
               fn _receipt -> {:error, :must_not_replay} end
             )

    refute Repo.exists?(
             from(receipt in CommandReceiptModel,
               where:
                 receipt.initiator_type == "user" and
                   receipt.initiator_key == ^to_string(user.id) and
                   receipt.command_key == ^command_key
             )
           )
  end

  test "expired receipt is reclaimed for a new execution" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()
    input = %{body: "same command after expiry"}

    assert {:ok, %{command_replayed: false}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %{id: "post-1"}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )

    from(receipt in CommandReceiptModel,
      where:
        receipt.initiator_type == "user" and
          receipt.initiator_key == ^to_string(user.id) and
          receipt.command_key == ^command_key
    )
    |> Repo.update_all(set: [expires_at: DateTime.add(DateTime.utc_now(), -1, :second)])

    assert {:ok, %{command_replayed: false}} =
             CommandReceipt.run_user_command(
               user,
               command_key,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %{id: "post-1"}} end,
               fn _receipt -> {:error, :must_not_replay} end
             )
  end

  test "concurrent requests with one identity execute the domain once" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_key = Ecto.UUID.generate()
    {:ok, executions} = Agent.start_link(fn -> 0 end)

    task_fun = fn ->
      receive do
        :start ->
          CommandReceipt.run_user_command(
            user,
            command_key,
            "article.update",
            "post",
            "concurrent-post",
            %{body: "same"},
            fn ->
              Agent.update(executions, &(&1 + 1))
              Process.sleep(100)
              {:ok, %{id: "post-1"}}
            end,
            fn _receipt -> {:ok, %{id: "post-1"}} end
          )
      end
    end

    tasks = Enum.map(1..2, fn _ -> Task.async(task_fun) end)

    Enum.each(tasks, fn %Task{pid: pid} ->
      Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid)
    end)

    Enum.each(tasks, &send(&1.pid, :start))
    results = Enum.map(tasks, &Task.await(&1, 5_000))

    assert Enum.count(results, fn
             {:ok, %{command_replayed: false}} -> true
             _ -> false
           end) == 1

    assert Enum.count(results, fn
             {:ok, %{command_replayed: true}} -> true
             _ -> false
           end) == 1

    assert Agent.get(executions, & &1) == 1
  end

  test "a competing claim times out with command_resolution_pending" do
    user = %User{id: 9_999_999}
    command_key = Ecto.UUID.generate()
    parent = self()

    run = fn execute, replay ->
      Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
        CommandReceipt.run_user_command(
          user,
          command_key,
          "article.update",
          "post",
          "timeout-post",
          %{body: "same"},
          execute,
          replay
        )
      end)
    end

    first =
      Task.async(fn ->
        run.(
          fn ->
            send(parent, :claim_owned)
            Process.sleep(5_000)
            {:ok, %{id: "post-1"}}
          end,
          fn _receipt -> {:ok, %{id: "post-1"}} end
        )
      end)

    assert_receive :claim_owned, 1_000

    second =
      Task.async(fn ->
        run.(fn -> {:error, :must_not_execute} end, fn _receipt -> {:ok, %{id: "post-1"}} end)
      end)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :command_resolution_pending}} =
             Task.await(second, 6_000)

    assert {:ok, %{command_replayed: false}} = Task.await(first, 6_000)

    Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
      Repo.delete_all(
        from(receipt in CommandReceiptModel,
          where:
            receipt.initiator_type == "user" and
              receipt.initiator_key == ^to_string(user.id) and
              receipt.command_key == ^command_key
        )
      )
    end)
  end

  test "prunes only receipts past the replay window" do
    expired_key = Ecto.UUID.generate()
    active_key = Ecto.UUID.generate()

    expired =
      Repo.insert!(
        CommandReceiptModel.changeset(%CommandReceiptModel{}, %{
          initiator_type: "user",
          initiator_key: "1",
          command_key: expired_key,
          command_name: "article.update",
          target_type: "post",
          target_key: "1",
          payload_fingerprint: "expired",
          outcome: "changed",
          expires_at: DateTime.add(DateTime.utc_now(), -1, :second)
        })
      )

    active =
      Repo.insert!(
        CommandReceiptModel.changeset(%CommandReceiptModel{}, %{
          initiator_type: "user",
          initiator_key: "1",
          command_key: active_key,
          command_name: "article.update",
          target_type: "post",
          target_key: "1",
          payload_fingerprint: "active",
          outcome: "changed",
          expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
        })
      )

    assert CommandReceipt.prune_expired() == 1
    assert Repo.get(CommandReceiptModel, expired.id) == nil
    assert Repo.get(CommandReceiptModel, active.id)
  end
end
