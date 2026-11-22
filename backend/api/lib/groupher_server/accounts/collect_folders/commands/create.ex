defmodule GroupherServer.Accounts.CollectFolders.Commands.Create do
  @moduledoc """
  Owns creation of one collection folder.

      Facade -> Commands.Create -> Persist
  """

  use GroupherServer.CommandPipeline

  alias GroupherServer.Accounts
  alias Accounts.CollectFolders.Persist
  alias Accounts.Model.User

  @pipeline operation: :accounts_collect_folder_create,
            access: :open,
            target: :user,
            params: [:attrs]

  direct_pipeline execute_pipeline(attrs, user) do
    change(fn _user, _operation_ref -> Persist.create(attrs, user) end)
  end

  @doc """
  Creates a user-owned collection folder.

  ## Examples

      Accounts.CollectFolders.Commands.Create.run(%{title: "Reading list"}, user)
  """
  @spec run(map(), User.t()) :: {:ok, struct()} | {:error, term()}
  def run(attrs, %User{} = user), do: execute_pipeline(attrs, user)
end
