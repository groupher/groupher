defmodule GroupherServer.CMS.DocTree.Publish.SiteLock do
  @moduledoc """
  Serializes Docs site writes on a Community before Queue and content locks.

      admitted command transaction -> site advisory lock -> Queue -> Article content

  The caller owns the transaction and Gate admission. This lock is independent
  of Queue initialization and remains held until transaction commit or rollback.
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Community
  alias Helper.ORM.AdvisoryLock

  @doc "Acquires the Community's site lock in the current transaction."
  def acquire(%Community{id: id}) when is_integer(id) and id > 0 do
    if Repo.in_transaction?() do
      AdvisoryLock.acquire!("docs_site:#{id}")
    else
      {:error, :transaction_required}
    end
  end

  def acquire(_community), do: {:error, :invalid_docs_site}
end
