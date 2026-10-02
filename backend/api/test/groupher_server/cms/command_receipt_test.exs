defmodule GroupherServer.Test.CMS.CommandReceiptTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.{Command, CommandReceipt}
  alias CMS.CommandReceipt.Store
  alias CMS.DocTree.CommandReplay

  test "replays the same user command and rejects a different fingerprint" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               {:ok, :new, receipt} =
                 Store.claim(
                   Integer.to_string(user.id),
                   command_id,
                   "article.update",
                   "post",
                   post.id,
                   %{body: "first"}
                 )

               {:ok, :new, receipt}
             end)

    assert {:ok, {:ok, :recovery, recovered}} =
             Repo.transaction(fn ->
               Store.claim(
                 Integer.to_string(user.id),
                 command_id,
                 "article.update",
                 "post",
                 post.id,
                 %{body: "first"}
               )
             end)

    assert recovered.id == receipt.id

    assert {:ok, {:error, %ErrorCat.Error{reason: :command_id_conflict}}} =
             Repo.transaction(fn ->
               Store.claim(
                 Integer.to_string(user.id),
                 command_id,
                 "article.update",
                 "post",
                 post.id,
                 %{body: "different"}
               )
             end)
  end

  test "failed transaction rolls back the receipt claim" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:error, :denied} =
             Repo.transaction(fn ->
               {:ok, :new, _receipt} =
                 Store.claim(
                   Integer.to_string(user.id),
                   command_id,
                   "article.delete",
                   "post",
                   post.id
                 )

               Repo.rollback(:denied)
             end)

    refute Repo.exists?(
             from(receipt in CMS.Model.CommandReceipt,
               where:
                 receipt.initiator_type == "user" and
                   receipt.initiator_key == ^to_string(user.id) and
                   receipt.command_id == ^command_id
             )
           )
  end

  test "store returns validation failures without relabeling them as command conflicts" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, {:error, %Ecto.Changeset{} = changeset}} =
             Repo.transaction(fn ->
               Store.claim(
                 Integer.to_string(user.id),
                 "not-a-uuid",
                 "article.update",
                 "post",
                 post.id
               )
             end)

    assert Keyword.has_key?(changeset.errors, :command_id)
  end

  test "runs and replays a user command with a composite string target" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update_draft",
               "article",
               "community:post:article-key",
               %{expected_version: 3, title: "first"},
               fn -> {:ok, %{id: "article-key"}} end,
               fn _receipt -> {:ok, %{id: "article-key"}} end
             )

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update_draft",
               "article",
               "community:post:article-key",
               %{expected_version: 3, title: "first"},
               fn -> {:error, :must_not_execute_on_replay} end,
               fn _receipt -> {:ok, %{id: "article-key"}} end
             )
  end

  test "uses the same result callback for first execution and replay" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    result = fn receipt ->
      send(self(), {:result_callback, receipt.outcome})
      {:ok, %{id: "article-key"}}
    end

    assert {:ok, %{id: "article-key"}} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update_draft",
               "article",
               "article-key",
               %{},
               fn -> {:ok, :ignored} end,
               result
             )

    assert {:ok, %{id: "article-key"}} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update_draft",
               "article",
               "article-key",
               %{},
               fn -> {:error, :must_not_execute_on_replay} end,
               result
             )

    assert_receive {:result_callback, "changed"}
    assert_receive {:result_callback, "changed"}
  end

  test "CMS.Command keeps declaration data out of the callback arguments" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :article_update_draft,
      target: {:article, "community"},
      params: %{title: "first"}
    }

    result = fn _receipt -> {:ok, %{id: "article-key"}} end

    assert {:ok, %{id: "article-key"}} =
             Command.execute(command,
               action: fn %{actor: ^user, params: %{title: "first"}} ->
                 {:ok, %{id: "article-key"}}
               end,
               result: result
             )

    assert Repo.get_by(CMS.Model.CommandReceipt, command_id: command_id).command ==
             "article.update_draft"

    assert {:ok, %{id: "article-key"}} =
             Command.execute(command,
               action: fn _context -> {:error, :must_not_execute_on_replay} end,
               result: result
             )
  end

  test "logical targets derive a stable identity without a synthetic collection" do
    {community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :article_create,
      target: {:article, community.id},
      params: %{title: "first"}
    }

    assert {:ok, %{id: "article-key"}} =
             Command.execute(command,
               action: fn %{target: {:article, community_id}, params: %{title: "first"}}
                          when community_id == community.id ->
                 {:ok, %{id: "article-key"}}
               end,
               result: fn _receipt -> {:ok, %{id: "article-key"}} end
             )

    assert Repo.get_by(CMS.Model.CommandReceipt, command_id: command_id).resource_type ==
             "article"

    assert Repo.get_by(CMS.Model.CommandReceipt, command_id: command_id).resource_id ==
             to_string(community.id)
  end

  test "CMS.Command encodes command atoms at the Receipt boundary" do
    {community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :doc_tree_create_tab,
      target: {:doc_tree, community.id},
      params: %{title: "Docs"}
    }

    assert {:ok, %{id: "tree-1"}} =
             Command.execute(command,
               action: fn %{params: %{title: "Docs"}} ->
                 {:ok, %{id: "tree-1"}}
               end,
               result: fn _receipt -> {:ok, %{id: "tree-1"}} end
             )

    assert Repo.get_by(CMS.Model.CommandReceipt, command_id: command_id).command ==
             "doc.tree.create_tab"
  end

  test "a nil command id cannot bypass the receipt boundary" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :command_id_required}} =
             CommandReceipt.run_internal(
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

  test "the receipt entry treats nil command id as missing" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :command_id_required}} =
             CommandReceipt.run_internal(
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

  test "invalid command ids fail closed before entering the receipt transaction" do
    {_community, _post, _attrs, user} = mock_article(:post)

    for command_id <- [42, false, [], %{}, "", "not-a-uuid"] do
      assert {:error, %ErrorCat.Error{reason: :command_id_invalid}} =
               CommandReceipt.run_internal(
                 user,
                 command_id,
                 "article.update",
                 "post",
                 "1",
                 %{},
                 fn -> {:ok, %{id: "post-1"}} end,
                 fn _receipt -> {:ok, %{id: "post-1"}} end
               )
    end

    assert {:error, %ErrorCat.Error{reason: :command_id_invalid}} =
             CommandReceipt.validate_command_id(%{command_id: ""})
  end

  test "invalid callbacks remain programming errors instead of command id errors" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert_raise ArgumentError,
                 "command receipt callbacks must be execute/0 and result/1 functions",
                 fn ->
                   CommandReceipt.run_internal(
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

  test "command id validation requires one direct UUID" do
    command_id = Ecto.UUID.generate()

    assert {:ok, ^command_id} = CommandReceipt.validate_command_id(command_id)

    assert {:error, %ErrorCat.Error{reason: :command_id_required}} =
             CommandReceipt.validate_command_id(nil)

    for invalid <- [42, false, [], %{}, "not-a-uuid"] do
      assert {:error, %ErrorCat.Error{reason: :command_id_invalid}} =
               CommandReceipt.validate_command_id(invalid)
    end
  end

  test "unchanged outcomes are replayable completed commands" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "upvote_remove",
               "post",
               "1",
               nil,
               fn -> {:ok, %{id: "post-1"}, %{outcome: :unchanged}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )

    assert Repo.get_by(CMS.Model.CommandReceipt,
             initiator_type: "user",
             initiator_key: to_string(user.id),
             command_id: command_id
           ).outcome == "unchanged"

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
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
    command_id = Ecto.UUID.generate()

    result = %{
      revision: 4,
      tree_state: %{has_unpublished_changes: true},
      node: %{id: "page-1", type: :page},
      affected_nodes: [%{id: "page-1", type: :page}],
      conflict: false
    }

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "doc.tree.update_node",
               "doc_tree",
               "community:1:page-1",
               %{base_revision: 3, title: "Intro"},
               fn -> {:ok, result, CommandReplay.tree_metadata(result, "community:1:page-1")} end,
               fn receipt ->
                 assert receipt.result_payload["schema_version"] == 1
                 assert receipt.result_payload["node"]["type"] == "page"
                 assert receipt.result_payload["tree_state"]["has_unpublished_changes"] == true
                 assert receipt.result_payload["conflict"] == false
                 {:ok, result}
               end
             )

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
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

  test "tree conflict replay accepts results without a node" do
    result = %{revision: 5, tree_state: %{}, affected_nodes: [], conflict: true}
    metadata = CommandReplay.tree_metadata(result, "community:1:page-1")

    receipt = %{
      result_key: metadata.result_key,
      result_payload: metadata.result_payload
    }

    assert metadata.result_payload["node"] == nil
    assert metadata.result_payload["conflict"] == true

    assert {:ok, %{node: nil, conflict: true, revision: 5}} =
             CommandReplay.replay_tree(receipt)
  end

  test "failed command execution rolls back its receipt claim" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:error, :denied} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.delete",
               "post",
               post.id,
               nil,
               fn -> {:error, :denied} end,
               fn _receipt -> {:error, :must_not_replay} end
             )

    refute Repo.exists?(
             from(receipt in CMS.Model.CommandReceipt,
               where:
                 receipt.initiator_type == "user" and
                   receipt.initiator_key == ^to_string(user.id) and
                   receipt.command_id == ^command_id
             )
           )
  end

  test "expired receipt is reclaimed for a new execution" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    input = %{body: "same command after expiry"}

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %{id: "post-1"}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )

    from(receipt in CMS.Model.CommandReceipt,
      where:
        receipt.initiator_type == "user" and
          receipt.initiator_key == ^to_string(user.id) and
          receipt.command_id == ^command_id
    )
    |> Repo.update_all(set: [expires_at: DateTime.add(DateTime.utc_now(), -1, :second)])

    assert {:ok, _result} =
             CommandReceipt.run_internal(
               user,
               command_id,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %{id: "post-1"}} end,
               fn _receipt -> {:ok, %{id: "post-1"}} end
             )
  end

  test "concurrent requests with one identity execute the domain once" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    {:ok, executions} = Agent.start_link(fn -> 0 end)

    task_fun = fn ->
      receive do
        :start ->
          CommandReceipt.run_internal(
            user,
            command_id,
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

    assert Enum.count(results, &match?({:ok, _}, &1)) == 2

    assert Agent.get(executions, & &1) == 1
  end

  test "a competing claim times out with command_resolution_pending" do
    user = %User{id: 9_999_999}
    command_id = Ecto.UUID.generate()
    parent = self()

    run = fn execute, replay ->
      Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
        CommandReceipt.run_internal(
          user,
          command_id,
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

    assert {:error, %ErrorCat.Error{reason: :command_resolution_pending}} =
             Task.await(second, 6_000)

    assert {:ok, _result} = Task.await(first, 6_000)

    Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
      Repo.delete_all(
        from(receipt in CMS.Model.CommandReceipt,
          where:
            receipt.initiator_type == "user" and
              receipt.initiator_key == ^to_string(user.id) and
              receipt.command_id == ^command_id
        )
      )
    end)
  end

  test "prunes only receipts past the replay window" do
    expired_key = Ecto.UUID.generate()
    active_key = Ecto.UUID.generate()

    expired =
      Repo.insert!(
        CMS.Model.CommandReceipt.changeset(%CMS.Model.CommandReceipt{}, %{
          initiator_type: "user",
          initiator_key: "1",
          command_id: expired_key,
          command: "article.update",
          resource_type: "post",
          resource_id: "1",
          payload_fingerprint: "expired",
          outcome: "changed",
          expires_at: DateTime.add(DateTime.utc_now(), -1, :second)
        })
      )

    active =
      Repo.insert!(
        CMS.Model.CommandReceipt.changeset(%CMS.Model.CommandReceipt{}, %{
          initiator_type: "user",
          initiator_key: "1",
          command_id: active_key,
          command: "article.update",
          resource_type: "post",
          resource_id: "1",
          payload_fingerprint: "active",
          outcome: "changed",
          expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
        })
      )

    assert CommandReceipt.prune_expired() == 1
    assert Repo.get(CMS.Model.CommandReceipt, expired.id) == nil
    assert Repo.get(CMS.Model.CommandReceipt, active.id)
  end
end
