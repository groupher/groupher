defmodule GroupherServer.Test.CMS.Command.OperationIdentityTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Activity, CMS, CommandPipeline}
  alias Activity.Model.PostLog
  alias CMS.Model.CommandReceipt
  alias CommandPipeline.{Rejected, RejectionContext, RejectionData}

  defmodule Confirmation do
    @behaviour CMS.Command.ConfirmationCodec
    defstruct [:value]

    def operations, do: [:article_update]

    def encode(%__MODULE__{value: value}, :article_update) do
      {:ok, %{"schema_version" => 1, "operation" => "article.update", "value" => value}}
    end

    def decode(%{"value" => value}, :article_update), do: {:ok, %__MODULE__{value: value}}
  end

  defmodule Fixture do
    use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

    @pipeline operation: :article_update,
              access: :internal,
              target: :target,
              params: [],
              confirmation: Confirmation
    receipt_pipeline run(target, actor, command_id, fail?) do
      change(fn _target, operation_ref ->
        send(self(), {:operation_ref, operation_ref})
        if fail?, do: {:error, :forced_failure}, else: {:ok, operation_ref}
      end)

      confirm(fn value -> {:ok, %Confirmation{value: value}} end)
    end

    @pipeline operation: :article_update,
              access: :internal,
              target: :target,
              params: [],
              confirmation: Confirmation
    receipt_pipeline reject(target, actor, command_id) do
      change(fn _target, operation_ref ->
        send(self(), {:rejected_operation_ref, operation_ref})
        {:error, Rejected.new(:receipt_rejected, :receipt_rejected)}
      end)

      confirm(fn value -> {:ok, %Confirmation{value: value}} end)
      on_rejection(&build_rejection/1)
    end

    defp build_rejection(%RejectionContext{arguments: %{target: target}}) do
      %RejectionData{resource: target, action: :trashed, rejection_code: :article_archived}
    end

    @pipeline operation: :test_direct_operation,
              access: :internal,
              target: :target,
              operation_ref: :operation_ref
    direct_pipeline direct(target, operation_ref) do
      change(fn _target, operation_ref -> {:ok, operation_ref} end)
    end
  end

  test "Receipt owns a stable UUID, replays it, and isolates actors" do
    {:ok, first} = db_insert(:user)
    {:ok, second} = db_insert(:user)
    command_id = Ecto.UUID.generate()
    target = {:article, Ecto.UUID.generate()}

    assert {:ok, %Confirmation{value: first_ref}} = Fixture.run(target, first, command_id, false)
    assert_receive {:operation_ref, ^first_ref}
    assert {:ok, %Confirmation{value: ^first_ref}} = Fixture.run(target, first, command_id, false)
    refute_receive {:operation_ref, _}, 20

    assert {:ok, %Confirmation{value: second_ref}} =
             Fixture.run(target, second, command_id, false)

    assert_receive {:operation_ref, ^second_ref}
    refute first_ref == second_ref

    receipt =
      Repo.get_by!(CommandReceipt, initiator_key: to_string(first.id), command_id: command_id)

    assert receipt.operation_ref == first_ref
    assert {:ok, ^first_ref} = Ecto.UUID.cast(receipt.operation_ref)
  end

  test "failed execution rolls back its claim and a direct step keeps its validated UUID" do
    {:ok, actor} = db_insert(:user)
    command_id = Ecto.UUID.generate()
    target = {:article, Ecto.UUID.generate()}

    assert {:error, :forced_failure} = Fixture.run(target, actor, command_id, true)
    assert_receive {:operation_ref, failed_ref}
    refute Repo.get_by(CommandReceipt, initiator_key: to_string(actor.id), command_id: command_id)

    assert {:ok, %Confirmation{value: committed_ref}} =
             Fixture.run(target, actor, command_id, false)

    assert_receive {:operation_ref, ^committed_ref}
    refute failed_ref == committed_ref

    step_ref = Ecto.UUID.generate()
    assert {:ok, ^step_ref} = Fixture.direct(target, step_ref)
    assert {:error, :invalid_operation_ref} = Fixture.direct(target, "not-a-uuid")
  end

  test "Receipt rejection audit keeps the generated operation ref across rollback" do
    {_community, post, _attrs, owner} = mock_article(:post)
    command_id = Ecto.UUID.generate()

    assert {:error, :receipt_rejected} = Fixture.reject(post, owner, command_id)
    assert_receive {:rejected_operation_ref, operation_ref}
    refute operation_ref == command_id

    event =
      Repo.one!(
        from(log in PostLog,
          where: log.article_id == ^post.article_id and log.action == :trashed
        )
      )

    assert event.operation_ref == operation_ref
    refute Repo.get_by(CommandReceipt, initiator_key: to_string(owner.id), command_id: command_id)
  end

  test "Receipt preflight failure does not invent an operation ref from command id" do
    {_community, post, _attrs, owner} = mock_article(:post)
    invalid_command_id = "not-a-uuid"

    assert {:error, _reason} = Fixture.reject(post, owner, invalid_command_id)
    refute_receive {:rejected_operation_ref, _operation_ref}

    refute Repo.exists?(
             from(log in PostLog,
               where: log.article_id == ^post.article_id and log.action == :trashed
             )
           )
  end
end
