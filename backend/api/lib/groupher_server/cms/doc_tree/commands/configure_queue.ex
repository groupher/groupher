defmodule GroupherServer.CMS.DocTree.Commands.ConfigureQueue do
  @moduledoc """
  Changes the site's approval policy under independent revision and Receipt guards.

      configuration command -> Gate / Receipt -> site lock -> policy + Activity + Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Activity, CMS}
  alias CMS.DocTree.{Publish.Queue, Commands.ConfigureQueueConfirmation}

  @pipeline operation: :docs_configure_queue,
            confirmation: ConfigureQueueConfirmation,
            target: :community,
            params: [:revision, :required, :self_approval]
  receipt_pipeline run_receipt(community, revision, required, self_approval, actor, command_id) do
    gate(fn canonical ->
      CMS.Gate.check_in_transaction(actor, :docs_queue_configure, canonical)
    end)

    change(fn canonical ->
      with {:ok, queue} <- Queue.lock_or_create(canonical),
           {:ok, result} <- Queue.set_policy(canonical, queue, revision, required, self_approval),
           {:ok, _} <- audit(canonical, queue, result, actor, command_id) do
        {:ok, result.queue}
      end
    end)

    confirm(fn queue ->
      {:ok,
       %ConfigureQueueConfirmation{
         data: %{
           "community_id" => community.id,
           "revision" => queue.approval_policy_revision,
           "required" => queue.approval_required,
           "self_approval" => queue.allow_self_approval
         }
       }}
    end)

    present(fn confirmation ->
      with {:ok, _} <- CMS.Gate.access_check(actor, :docs_queue_configure, community) do
        {:ok,
         %{
           approval_policy_revision: confirmation.data["revision"],
           approval_required: confirmation.data["required"],
           allow_self_approval: confirmation.data["self_approval"]
         }}
      end
    end)
  end

  @doc "Applies an explicit approval policy change without advancing queue content revision."
  def execute(community, revision, required, self_approval, actor, command_id)
      when is_integer(revision) and revision >= 0 and is_boolean(required) and
             is_boolean(self_approval) do
    run_receipt(community, revision, required, self_approval, actor, command_id)
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_queue_policy}

  defp audit(_site, _old, %{changed?: false}, _actor, _command), do: {:ok, :unchanged}

  defp audit(site, old, %{queue: updated}, actor, command) do
    Activity.log(site, :docs_approval_policy_changed,
      actor: actor,
      operation_ref: command,
      payload: %{
        before:
          Map.take(old, [:approval_required, :allow_self_approval, :approval_policy_revision]),
        after:
          Map.take(updated, [:approval_required, :allow_self_approval, :approval_policy_revision])
      }
    )
  end
end
