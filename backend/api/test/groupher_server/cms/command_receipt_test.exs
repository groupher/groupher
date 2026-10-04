defmodule GroupherServer.Test.CMS.BadConfirmation do
  @behaviour GroupherServer.CMS.Command.ConfirmationCodec

  defstruct [:value]

  @impl true
  def operations, do: [:upvote_add]

  @impl true
  def encode(%__MODULE__{}, _operation),
    do: {:ok, %{"schema_version" => 1, "operation" => "wrong.operation", "value" => true}}

  @impl true
  def decode(_payload, _operation), do: {:error, :invalid}
end

defmodule GroupherServer.Test.CMS.OversizedConfirmation do
  @behaviour GroupherServer.CMS.Command.ConfirmationCodec

  defstruct [:value]

  @impl true
  def operations, do: [:upvote_add]

  @impl true
  def encode(%__MODULE__{value: value}, :upvote_add),
    do: {:ok, %{"schema_version" => 1, "operation" => "upvote.add", "value" => value}}

  @impl true
  def decode(%{"value" => value}, :upvote_add), do: {:ok, %__MODULE__{value: value}}
  def decode(_payload, _operation), do: {:error, :invalid}
end

defmodule GroupherServer.Test.CMS.ReceiptConfirmation do
  @behaviour GroupherServer.CMS.Command.ConfirmationCodec

  defstruct [:value]

  @impl true
  def operations, do: [:article_update, :article_trash]

  @impl true
  def encode(%__MODULE__{value: value}, operation) do
    {:ok,
     %{
       "schema_version" => 1,
       "operation" => GroupherServer.CMS.Command.operation_tag(operation),
       "value" => value
     }}
  end

  @impl true
  def decode(%{"value" => value}, _operation), do: {:ok, %__MODULE__{value: value}}
  def decode(_payload, _operation), do: {:error, :invalid}
end

defmodule GroupherServer.Test.CMS.CommandReceiptTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.Command
  alias CMS.Command.IntentCodec
  alias CMS.Command.Receipt, as: CommandReceipt
  alias CMS.Command.Receipt.Store
  alias CMS.Interactions.Reactions.UpvoteConfirmation, as: UpvoteConfirmation
  alias GroupherServer.Test.CMS.BadConfirmation
  alias GroupherServer.Test.CMS.OversizedConfirmation
  alias GroupherServer.Test.CMS.ReceiptConfirmation

  import ExUnit.CaptureLog

  test "replays the same user command and rejects different intent params" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    {:ok, first_params} = IntentCodec.encode(:article_update, %{body: "first"})
    {:ok, different_params} = IntentCodec.encode(:article_update, %{body: "different"})

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               {:ok, :new, receipt} =
                 Store.claim(
                   Integer.to_string(user.id),
                   command_id,
                   "article.update",
                   "post",
                   post.id,
                   first_params
                 )

               {:ok, receipt} =
                 Store.finalize(receipt, %{
                   confirmation: %{"schema_version" => 1, "operation" => "article.update"}
                 })

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
                 first_params
               )
             end)

    assert recovered.id == receipt.id
    assert receipt.intent_params["body"]["__redacted__"]
    assert receipt.intent_params["body"]["bytes"] == 7

    assert {:ok,
            {:error,
             %ErrorCat.Error{
               reason: :command_id_conflict,
               details: %{different_fields: ["body"]}
             }}} =
             Repo.transaction(fn ->
               Store.claim(
                 Integer.to_string(user.id),
                 command_id,
                 "article.update",
                 "post",
                 post.id,
                 different_params
               )
             end)
  end

  test "Confirmation command executes once, stores JSON, and replays the decoded value" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    parent = self()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    action = fn _context ->
      send(parent, :action_called)

      {:ok,
       %UpvoteConfirmation{
         data: %{
           "operation" => "add",
           "outcome" => "changed",
           "target_id" => to_string(post.id),
           "target_type" => "article"
         }
       }}
    end

    assert {:ok, first} =
             Command.execute(command, action: action, confirmation: UpvoteConfirmation)

    assert_receive :action_called

    assert {:ok, second} =
             Command.execute(command,
               action: fn _ ->
                 send(parent, :must_not_execute)
                 {:error, :unexpected}
               end,
               confirmation: UpvoteConfirmation
             )

    assert first == second
    refute_receive :must_not_execute

    receipt =
      Repo.get_by!(CMS.Model.CommandReceipt,
        initiator_type: "user",
        initiator_key: to_string(user.id),
        command_id: command_id
      )

    assert receipt.confirmation["operation"] == "upvote.add"
  end

  test "optional presenter can reuse first-execution context and still handles recovery" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    parent = self()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    action = fn _context ->
      send(parent, :action_called)

      {:ok,
       %UpvoteConfirmation{
         data: %{
           "operation" => "add",
           "outcome" => "changed",
           "target_id" => to_string(post.id),
           "target_type" => "article"
         }
       }, %{source: :action}}
    end

    presenter = fn _confirmation, %{state: state, action_context: context} ->
      {:ok, %{state: state, context: context}}
    end

    assert {:ok, %{state: :executed, context: %{source: :action}}} =
             Command.execute(command,
               action: action,
               confirmation: UpvoteConfirmation,
               present: presenter
             )

    assert_received :action_called

    assert {:ok, %{state: :recovered, context: nil}} =
             Command.execute(command,
               action: fn _ -> flunk("recovery must not execute the action") end,
               confirmation: UpvoteConfirmation,
               present: presenter
             )

    refute_received :action_called
  end

  test "rejects a presenter result outside the business result contract" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    action = fn _context ->
      {:ok,
       %UpvoteConfirmation{
         data: %{
           "operation" => "add",
           "outcome" => "changed",
           "target_id" => to_string(post.id),
           "target_type" => "article"
         }
       }}
    end

    assert {:error, %ErrorCat.Error{reason: :command_invalid_result}} =
             Command.execute(command,
               action: action,
               confirmation: UpvoteConfirmation,
               present: fn _confirmation, _context -> %{unexpected: :raw_value} end
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

  test "rejects an oversized Confirmation before finalizing the receipt" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    assert {:error, %ErrorCat.Error{reason: :command_invalid_result}} =
             Command.execute(command,
               action: fn _ ->
                 {:ok, %OversizedConfirmation{value: String.duplicate("x", 1_048_600)}}
               end,
               confirmation: OversizedConfirmation
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

  test "does not log Confirmation contents when recovery decoding fails" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    secret = "draft-secret-that-must-not-reach-logs"
    {:ok, intent_params} = IntentCodec.encode(:upvote_add, %{operation: :add})

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 command_id,
                 "upvote.add",
                 "article",
                 post.id,
                 intent_params
               )
             end)

    assert {:ok, _finalized} =
             Repo.transaction(fn ->
               Store.finalize(receipt, %{
                 confirmation: %{"operation" => "upvote.add", "secret" => secret}
               })
             end)

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    log =
      capture_log(fn ->
        assert {:error, %ErrorCat.Error{reason: :command_result_unavailable}} =
                 Command.execute(command,
                   action: fn _ -> {:error, :must_not_execute} end,
                   confirmation: UpvoteConfirmation
                 )
      end)

    assert log =~ "confirmation_bytes"
    refute log =~ secret
  end

  test "unsupported Confirmation configuration fails before claim as an internal contract error" do
    {_community, post, _attrs, user} = mock_article(:post)

    command = %Command{
      actor: user,
      command_id: Ecto.UUID.generate(),
      operation: :unsupported_operation,
      target: post,
      params: %{operation: :add}
    }

    assert {:error, %ErrorCat.Error{reason: :command_invalid_result}} =
             Command.execute(command,
               action: fn _ -> {:error, :must_not_execute} end,
               confirmation: UpvoteConfirmation
             )
  end

  test "first execution rejects an encoder that emits the wrong operation tag" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    assert {:error, %ErrorCat.Error{reason: :command_invalid_result}} =
             Command.execute(command,
               action: fn _ -> {:ok, %BadConfirmation{value: true}} end,
               confirmation: BadConfirmation
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

  test "intent params canonicalize keyword order and reject structs" do
    {_community, post, _attrs, user} = mock_article(:post)
    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()

    assert {:ok, {:ok, :new, _}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 first_id,
                 "article.update",
                 "post",
                 post.id,
                 title: "first",
                 expected_version: 3
               )
             end)

    assert {:ok, {:ok, :new, _}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 second_id,
                 "article.update",
                 "post",
                 post.id,
                 expected_version: 3,
                 title: "first"
               )
             end)

    assert {:ok, {:error, :invalid_intent_params}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 Ecto.UUID.generate(),
                 "article.update",
                 "post",
                 post.id,
                 %{draft: %CMS.Model.Article{}}
               )
             end)
  end

  test "IntentCodec persists authored fields only as digests, including future field names" do
    assert {:ok, encoded} =
             IntentCodec.encode(:article_update, %{
               description: "private description",
               content_json: %{"secret" => true}
             })

    assert encoded["description"]["__redacted__"]
    assert encoded["content_json"]["__redacted__"]
    refute inspect(encoded) =~ "private description"
    refute inspect(encoded) =~ "secret"
  end

  test "IntentCodec digest is stable across nested map construction order" do
    assert {:ok, first} =
             IntentCodec.encode(:article_create, %{
               thread: :post,
               attrs: Map.new([{:title, "same"}, {:meta, %{b: 2, a: 1}}])
             })

    assert {:ok, second} =
             IntentCodec.encode(:article_create, %{
               attrs: Map.new([{:meta, %{a: 1, b: 2}}, {:title, "same"}]),
               thread: :post
             })

    assert first == second
  end

  test "a nil command id cannot bypass the receipt boundary" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :command_id_required}} =
             CommandReceipt.execute(
               user,
               nil,
               "article.update",
               "post",
               "1",
               %{},
               fn -> {:ok, %{id: "post-1"}} end,
               ReceiptConfirmation
             )
  end

  test "the receipt entry treats nil command id as missing" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :command_id_required}} =
             CommandReceipt.execute(
               user,
               nil,
               "article.update",
               "post",
               "1",
               %{},
               fn -> {:ok, %{id: "post-1"}} end,
               ReceiptConfirmation
             )
  end

  test "invalid command ids fail closed before entering the receipt transaction" do
    {_community, _post, _attrs, user} = mock_article(:post)

    for command_id <- [42, false, [], %{}, "", "not-a-uuid"] do
      assert {:error, %ErrorCat.Error{reason: :command_id_invalid}} =
               CommandReceipt.execute(
                 user,
                 command_id,
                 "article.update",
                 "post",
                 "1",
                 %{},
                 fn -> {:ok, %{id: "post-1"}} end,
                 ReceiptConfirmation
               )
    end

    assert {:error, %ErrorCat.Error{reason: :command_id_invalid}} =
             CommandReceipt.validate_command_id(%{command_id: ""})
  end

  test "invalid callbacks remain programming errors instead of command id errors" do
    {_community, _post, _attrs, user} = mock_article(:post)

    assert_raise ArgumentError,
                 "command receipt callbacks must be execute/0 and a confirmation module",
                 fn ->
                   CommandReceipt.execute(
                     user,
                     Ecto.UUID.generate(),
                     "article.update",
                     "post",
                     "1",
                     %{},
                     :not_an_execute_callback,
                     ReceiptConfirmation
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

  test "failed command execution rolls back its receipt claim" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:error, :denied} =
             CommandReceipt.execute(
               user,
               command_id,
               "article.trash",
               "post",
               post.id,
               %{},
               fn -> {:error, :denied} end,
               ReceiptConfirmation
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

  test "receipt is reclaimed after the identity window expires" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    input = %{body: "same command after expiry"}

    assert {:ok, _result} =
             CommandReceipt.execute(
               user,
               command_id,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %ReceiptConfirmation{value: %{"id" => "post-1"}}} end,
               ReceiptConfirmation
             )

    from(receipt in CMS.Model.CommandReceipt,
      where:
        receipt.initiator_type == "user" and
          receipt.initiator_key == ^to_string(user.id) and
          receipt.command_id == ^command_id
    )
    |> Repo.update_all(
      set: [
        expires_at: DateTime.add(DateTime.utc_now(), -1, :second),
        identity_expires_at: DateTime.add(DateTime.utc_now(), -1, :second)
      ]
    )

    assert {:ok, _result} =
             CommandReceipt.execute(
               user,
               command_id,
               "article.update",
               "post",
               "1",
               input,
               fn -> {:ok, %ReceiptConfirmation{value: %{"id" => "post-1"}}} end,
               ReceiptConfirmation
             )
  end

  test "concurrent requests with one identity execute the domain once" do
    {_community, _post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    {:ok, executions} = Agent.start_link(fn -> 0 end)

    task_fun = fn ->
      receive do
        :start ->
          CommandReceipt.execute(
            user,
            command_id,
            "article.update",
            "post",
            "concurrent-post",
            %{body: "same"},
            fn ->
              Agent.update(executions, &(&1 + 1))
              Process.sleep(100)
              {:ok, %ReceiptConfirmation{value: %{"id" => "post-1"}}}
            end,
            ReceiptConfirmation
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

  test "same intent params after result expiry returns expired without executing" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    {:ok, intent_params} = IntentCodec.encode(:upvote_add, %{operation: :add})

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 command_id,
                 "upvote.add",
                 "article",
                 post.id,
                 intent_params
               )
             end)

    Repo.update_all(
      from(receipt in CMS.Model.CommandReceipt, where: receipt.id == ^receipt.id),
      set: [
        expires_at: DateTime.add(DateTime.utc_now(), -1, :second),
        identity_expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
      ]
    )

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :add}
    }

    assert {:error, %ErrorCat.Error{reason: :command_result_expired, actions: [:reconcile]}} =
             Command.execute(command,
               action: fn _ -> flunk("expired result must not execute") end,
               confirmation: UpvoteConfirmation
             )

    assert Repo.get(CMS.Model.CommandReceipt, receipt.id)
  end

  test "different intent params after result expiry remains a command conflict" do
    {_community, post, _attrs, user} = mock_article(:post)
    command_id = Ecto.UUID.generate()
    {:ok, intent_params} = IntentCodec.encode(:upvote_add, %{operation: :add})

    assert {:ok, {:ok, :new, receipt}} =
             Repo.transaction(fn ->
               Store.claim(
                 to_string(user.id),
                 command_id,
                 "upvote.add",
                 "article",
                 post.id,
                 intent_params
               )
             end)

    Repo.update_all(
      from(row in CMS.Model.CommandReceipt, where: row.id == ^receipt.id),
      set: [
        expires_at: DateTime.add(DateTime.utc_now(), -1, :second),
        identity_expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
      ]
    )

    command = %Command{
      actor: user,
      command_id: command_id,
      operation: :upvote_add,
      target: post,
      params: %{operation: :remove}
    }

    assert {:error, %ErrorCat.Error{reason: :command_id_conflict}} =
             Command.execute(command,
               action: fn _ -> flunk("conflicting result must not execute") end,
               confirmation: UpvoteConfirmation
             )
  end

  test "a competing claim times out with command_resolution_pending" do
    user = %User{id: 9_999_999}
    command_id = Ecto.UUID.generate()
    parent = self()

    run = fn execute ->
      Ecto.Adapters.SQL.Sandbox.unboxed_run(Repo, fn ->
        CommandReceipt.execute(
          user,
          command_id,
          "article.update",
          "post",
          "timeout-post",
          %{body: "same"},
          execute,
          ReceiptConfirmation
        )
      end)
    end

    first =
      Task.async(fn ->
        run.(fn ->
          send(parent, :claim_owned)
          Process.sleep(5_000)
          {:ok, %ReceiptConfirmation{value: %{"id" => "post-1"}}}
        end)
      end)

    assert_receive :claim_owned, 1_000

    second =
      Task.async(fn ->
        run.(fn -> {:error, :must_not_execute} end)
      end)

    assert {:error,
            %ErrorCat.Error{
              reason: :command_resolution_pending,
              actions: [:retry, :reconcile]
            }} =
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
          intent_params: %{"title" => "expired"},
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
          intent_params: %{"title" => "active"},
          expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
        })
      )

    assert CommandReceipt.prune_expired() == 1
    assert Repo.get(CMS.Model.CommandReceipt, expired.id) == nil
    assert Repo.get(CMS.Model.CommandReceipt, active.id)
  end

  test "compacts expired results while retaining an identity tombstone" do
    command_id = Ecto.UUID.generate()

    receipt =
      Repo.insert!(
        CMS.Model.CommandReceipt.changeset(%CMS.Model.CommandReceipt{}, %{
          initiator_type: "user",
          initiator_key: "1",
          command_id: command_id,
          command: "article.update",
          resource_type: "post",
          resource_id: "1",
          intent_params: %{"title" => "expired-result"},
          confirmation: %{"schema_version" => 1, "body" => "sensitive"},
          expires_at: DateTime.add(DateTime.utc_now(), -1, :second),
          identity_expires_at: DateTime.add(DateTime.utc_now(), 60, :second)
        })
      )

    assert Store.prune_expired() == 1

    compacted = Repo.get(CMS.Model.CommandReceipt, receipt.id)
    assert compacted
    assert compacted.confirmation == nil
    assert compacted.identity_expires_at
  end
end
