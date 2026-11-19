defmodule GroupherServer.Accounts.CollectFolders.Commands.Add do
  @moduledoc """
  Adds an article to a collection folder through the shared pipeline runner.

  Accounts owns folder membership while CMS owns the collect interaction. Both
  changes join the transaction owned by this top-level pipeline.

      collect add -> pipeline runner -> CMS Receipt -> Accounts writes
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.CollectFolders.{MembershipConfirmation, Persist}
  alias Accounts.Model.User
  alias Helper.ORM

  @pipeline operation: :collect_add,
            access: :user,
            target: :article,
            params: [:folder_id],
            confirmation: MembershipConfirmation

  receipt_pipeline execute_receipt(article, folder_id, user, command_id) do
    gate(fn _article ->
      prepare_gated_add(article, folder_id, user, command_id)
    end)

    change(fn prepared, _operation_ref -> apply_add(prepared, article, user) end)
    confirm(fn folder -> confirmation(folder, article, folder_id, :add) end)
    present(fn confirmation -> present_confirmation(confirmation, command_id) end)
  end

  @pipeline operation: :collect_add_direct, access: :user, target: :article, params: [:folder_id]

  direct_pipeline execute_direct(article, folder_id, user) do
    gate(fn _article -> prepare_gated_add(article, folder_id, user, Ecto.UUID.generate()) end)
    change(fn prepared, _operation_ref -> apply_add(prepared, article, user) end)
    present(fn folder -> {:ok, %{folder: folder, command_id: nil}} end)
  end

  @doc """
  Runs the non-replayable Accounts facade path.

  ## Examples

      Accounts.CollectFolders.Commands.Add.run_direct(article, folder_id, user)
  """
  @spec run_direct(struct(), term(), User.t()) :: {:ok, map()} | {:error, term()}
  def run_direct(article, folder_id, %User{} = user) do
    execute_direct(article, folder_id, user)
  end

  @doc """
  Runs the retry-safe Receipt facade path.

  ## Examples

      Accounts.CollectFolders.Commands.Add.run_receipt(article, folder_id, user, command_id)
  """
  @spec run_receipt(struct(), term(), User.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def run_receipt(article, folder_id, %User{} = user, command_id) do
    execute_receipt(article, folder_id, user, command_id)
  end

  defp prepare_gated_add(article, folder_id, user, command_id) do
    with {:ok, prepared} <- Persist.prepare_add(article, folder_id, user),
         {:ok, canonical} <-
           CMS.authorize_interaction_in_transaction(user, :collect, article) do
      {:ok, prepared |> Map.put(:canonical, canonical) |> Map.put(:command_id, command_id)}
    end
  end

  defp apply_add(prepared, article, user) do
    with {:ok, _canonical} <-
           CMS.apply_collect_change_in_transaction(
             prepared.canonical,
             user,
             :add,
             prepared.command_id
           ),
         {:ok, article_collect} <- CMS.interactions_persist_find_collect(article, user),
         {:ok, folder} <-
           Persist.add_in_transaction(
             prepared.folder,
             prepared.thread,
             prepared.binding
           ),
         {:ok, _attached} <-
           CMS.interactions_persist_attach_collect_folder(article_collect, folder) do
      {:ok, folder}
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
