defmodule GroupherServer.Accounts.CollectFolders.Commands.Update do
  @moduledoc """
  Owns updates to editable collection-folder fields.

      Facade -> Commands.Update -> Persist
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.CollectFolders.Persist

  @pipeline operation: :accounts_collect_folder_update,
            access: :open,
            target: :folder_id,
            params: [:attrs]

  direct_pipeline execute_pipeline(folder_id, attrs) do
    change(fn _folder_id, _operation_ref -> Persist.update(folder_id, attrs) end)
  end

  @doc """
  Updates editable fields on a collection folder.

  ## Examples

      Accounts.CollectFolders.Commands.Update.run(folder_id, %{title: "Read later"})
  """
  @spec run(term(), map()) :: {:ok, struct()} | {:error, term()}
  def run(folder_id, attrs), do: execute_pipeline(folder_id, attrs)
end
