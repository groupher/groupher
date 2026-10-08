defmodule GroupherServer.CMS.Communities.CreationPersist do
  @moduledoc """
  Provides the core Community insert used by creation Commands and workflows.

      Communities.Commands.Create / Communities.Creation
        -> CreationPersist.create_core
        -> Communities.Persist.insert_core
        -> Community row

  This module deliberately owns no Gate decision, transaction, Lifecycle
  transition, Receipt, Outbox effect, or client identity generation.
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.T

  @doc """
  Inserts the core Community row inside the caller-owned transaction.

  ## Examples

      CreationPersist.create_core(%{title: "Docs", slug: "docs"}, actor)
      #=> {:ok, %CMS.Model.Community{}} | {:error, reason}
  """
  @spec create_core(map(), User.t()) :: T.domain_res(Community.t())
  def create_core(args, %User{} = user), do: CMS.Communities.Persist.insert_core(args, user)
end
