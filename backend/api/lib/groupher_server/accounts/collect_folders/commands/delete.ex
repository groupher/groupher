defmodule GroupherServer.Accounts.CollectFolders.Commands.Delete do
  @moduledoc """
  Owns deletion of empty collection folders.

      Facade -> Commands.Delete -> Persist
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.CollectFolders.Persist

  @pipeline operation: :accounts_collect_folder_delete, access: :open, target: :folder_id

  direct_pipeline execute_pipeline(folder_id) do
    change(fn _folder_id, _operation_ref -> Persist.delete(folder_id) end)
  end

  @doc """
  Deletes an empty collection folder.

  ## Examples

      Accounts.CollectFolders.Commands.Delete.run(folder_id)
  """
  @spec run(term()) :: {:ok, struct()} | {:error, term()}
  def run(folder_id), do: execute_pipeline(folder_id)
end
