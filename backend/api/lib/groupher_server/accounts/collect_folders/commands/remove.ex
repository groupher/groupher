defmodule GroupherServer.Accounts.CollectFolders.Commands.Remove do
  @moduledoc """
  Removes an article from a collection folder through the shared pipeline
  runner, with explicit direct and retry-safe Receipt entries.

      collect remove -> pipeline runner -> CMS Receipt -> Accounts writes
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.CollectFolders.{MembershipConfirmation, Persist}
  alias Accounts.Model.User
  alias Helper.ORM

  @pipeline operation: :collect_remove,
            access: :user,
            target: :article,
            params: [:folder_id],
            confirmation: MembershipConfirmation

  receipt_pipeline execute_receipt(article, folder_id, user, command_id) do
    gate(fn _article ->
      prepare_gated_remove(article, folder_id, user, command_id)
    end)

    change(fn prepared, _operation_ref -> apply_remove(prepared, article, user) end)
    confirm(fn folder -> confirmation(folder, article, folder_id, :remove) end)
    present(fn confirmation -> present_confirmation(confirmation, command_id) end)
  end

  @pipeline operation: :collect_remove_direct,
            access: :user,
            target: :article,
            params: [:folder_id]

  direct_pipeline execute_direct(article, folder_id, user) do
    gate(fn _article -> prepare_gated_remove(article, folder_id, user, Ecto.UUID.generate()) end)
    change(fn prepared, _operation_ref -> apply_remove(prepared, article, user) end)
    present(fn folder -> {:ok, %{folder: folder, command_id: nil}} end)
  end

  @doc """
  Runs the non-replayable Accounts facade path.

  ## Examples

      Accounts.CollectFolders.Commands.Remove.run_direct(article, folder_id, user)
  """
  @spec run_direct(struct(), term(), User.t()) :: {:ok, map()} | {:error, term()}
  def run_direct(article, folder_id, %User{} = user) do
    execute_direct(article, folder_id, user)
  end

  @doc """
  Runs the retry-safe Receipt facade path.

  ## Examples

      Accounts.CollectFolders.Commands.Remove.run_receipt(article, folder_id, user, command_id)
  """
  @spec run_receipt(struct(), term(), User.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def run_receipt(article, folder_id, %User{} = user, command_id) do
    execute_receipt(article, folder_id, user, command_id)
  end

  defp prepare_gated_remove(article, folder_id, user, command_id) do
    with {:ok, prepared} <- Persist.prepare_remove(article, folder_id, user),
         {:ok, canonical} <-
           CMS.authorize_interaction_in_transaction(user, :collect, article) do
      {:ok, prepared |> Map.put(:canonical, canonical) |> Map.put(:command_id, command_id)}
    end
  end

  defp apply_remove(prepared, article, user) do
    with {:ok, article_collect} <- CMS.interactions_persist_find_collect(article, user),
         {:ok, removal} <-
           Persist.remove_in_transaction(
             prepared.folder,
             prepared.thread,
             prepared.binding,
             prepared.user_id
           ),
         {:ok, _canonical} <- maybe_undo_collect(prepared, user, removal),
         {:ok, _detached} <- maybe_detach_collect(article_collect, removal) do
      folder = removal.folder
      {:ok, folder}
    end
  end

  defp maybe_undo_collect(prepared, user, removal) do
    if not removal.remaining_in_account? do
      CMS.apply_collect_change_in_transaction(
        prepared.canonical,
        user,
        :remove,
        prepared.command_id
      )
    else
      {:ok, :pass}
    end
  end

  defp maybe_detach_collect(article_collect, removal) do
    if removal.remaining_in_account? and not removal.remaining_in_folder? do
      CMS.interactions_persist_detach_collect_folder(article_collect, removal.folder)
    else
      {:ok, :pass}
    end
  end

  defp confirmation(folder, article, folder_id, operation) do
    {:ok,
     %MembershipConfirmation{
       data: %{
         "folder_id" => to_string(folder_id),
         "article_id" => to_string(article.id),
         "operation" => Atom.to_string(operation),
         "total_count" => folder.total_count
       }
     }}
  end

  defp present_confirmation(%MembershipConfirmation{data: data}, command_id) do
    with {:ok, folder} <- ORM.find(Accounts.Model.CollectFolder, data["folder_id"]) do
      {:ok, %{folder: folder, command_id: command_id}}
    end
  end
end
