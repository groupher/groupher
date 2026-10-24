defmodule GroupherServer.CMS.DocTree.Commands.PermanentlyDeleteTrashItem do
  @moduledoc """
  Permanently deletes one Docs Tree Trash action through the command boundary.

      GraphQL / CMS.Trash
        -> PermanentlyDeleteTrashItem.execute
        -> CMS.Command Receipt
        -> DocTree.Trash permanent-delete owner

  Scheduler cleanup uses the explicit internal direct pipeline and the stable
  Trash action identity. It does not reuse the user Receipt protocol.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS
  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Command.Receipt.Key, as: CommandKey
  alias CMS.DocTree.Commands.{Support, TrashPermanentDeleteConfirmation}
  alias CMS.DocTree.Trash
  alias CMS.FrontDesk
  alias CMS.Model.TrashAction

  @pipeline operation: :doc_tree_permanently_delete_trash_item,
            confirmation: TrashPermanentDeleteConfirmation,
            target: :command_target,
            params: :command_params
  receipt_pipeline run_receipt(
                     action_or_ref,
                     actor,
                     opts,
                     command_id,
                     command_target,
                     command_params
                   ) do
    gate(fn _target ->
      load_and_authorize(action_or_ref, opts, actor, command_target, command_params)
    end)

    change(fn %{action: action} -> Trash.permanently_delete_action(action, actor, opts) end)

    confirm(fn _result ->
      {:ok,
       %TrashPermanentDeleteConfirmation{
         data: %{"command_id" => to_string(command_id), "done" => true}
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)
  end

  @pipeline operation: :doc_tree_permanently_delete_trash_item_internal,
            access: :internal,
            target: :action_or_ref,
            params: :opts
  direct_pipeline run_internal(action_or_ref, opts) do
    gate(fn _target ->
      load_and_authorize(action_or_ref, opts, :operations, nil, nil)
    end)

    change(fn %{action: action} -> Trash.permanently_delete_action(action, :system, opts) end)
  end

  @spec execute(TrashAction.t() | String.t(), User.t(), keyword()) ::
          {:ok, term()} | {:error, term()}
  def execute(action_or_ref, %User{} = actor, opts) do
    with {:ok, command_id} <- CommandKey.validate(Support.option(opts, :command_id)),
         {:ok, community_id} <- required_community_id(opts) do
      run_receipt(
        action_or_ref,
        actor,
        opts,
        command_id,
        {:doc_tree_trash, community_id},
        %{action_ref: action_ref(action_or_ref), opts: canonical_opts(opts)}
      )
    end
  end

  def execute(_action_or_ref, _actor, _opts), do: {:error, :invalid_actor}

  @doc false
  @spec execute_internal(TrashAction.t() | String.t(), keyword()) ::
          {:ok, term()} | {:error, term()}
  def execute_internal(action_or_ref, opts \\ []) do
    run_internal(action_or_ref, opts)
  end

  defp load_and_authorize(action_or_ref, opts, actor, _command_target, _command_params) do
    with {:ok, action} <- load_action(action_or_ref, opts),
         {:ok, community} <- FrontDesk.community(action.community_id, mode: :internal),
         {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :manage_docs, community) do
      {:ok, %{action: action, community: canonical}}
    end
  end

  defp load_action(%TrashAction{} = action, opts) do
    with {:ok, :pass} <- ensure_scope(action, opts), do: {:ok, action}
  end

  defp load_action(action_ref, opts) do
    with {:ok, action} <- CMS.Trash.get_action(action_ref),
         {:ok, :pass} <- ensure_scope(action, opts) do
      {:ok, action}
    end
  end

  defp ensure_scope(%TrashAction{root_type: root_type} = action, opts) do
    with true <- String.starts_with?(root_type, "doc_tree_"),
         {:ok, community_id} <- required_community_id(opts),
         true <- action.community_id == community_id,
         {:ok, :doc} <- CMS.Trash.action_thread(action),
         true <- Keyword.get(opts, :thread, :doc) == :doc do
      {:ok, :pass}
    else
      _ -> {:error, CMS.Articles.ErrorCat.not_exist("TrashAction")}
    end
  end

  defp required_community_id(opts) do
    case Support.option(opts, :community_id) do
      community_id when is_integer(community_id) -> {:ok, community_id}
      _ -> {:error, :community_id_required}
    end
  end

  defp canonical_opts(opts), do: Keyword.delete(opts, :command_id) |> Map.new()
  defp action_ref(%TrashAction{hash_id: hash_id}), do: hash_id
  defp action_ref(action_ref), do: action_ref

  defp present_confirmation(%TrashPermanentDeleteConfirmation{
         data: %{"command_id" => command_id, "done" => true}
       }) do
    {:ok, %{done: true, command_id: command_id}}
  end

  defp present_confirmation(_confirmation) do
    {:error, CMS.ErrorCat.command_result_unavailable()}
  end
end
