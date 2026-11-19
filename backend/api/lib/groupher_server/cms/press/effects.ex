defmodule GroupherServer.CMS.Press.Effects do
  @moduledoc """
  Records rebuildable Press projection effects inside the config transaction.

      Press config transaction
        -> Press.Effects
        -> CMS Outbox
        -> Press invalidation Worker
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Community
  alias CMS.Outbox.DedupeKey

  @doc "Records one versioned Press cache-invalidation intent in the caller's transaction."
  @spec enqueue_invalidation(Community.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_invalidation(%Community{id: community_id}, operation_ref)
      when is_integer(community_id) and is_binary(operation_ref) do
    CMS.Outbox.send(%{
      event: "press.cache_invalidation",
      worker: GroupherServer.Jobs.CMSOutboxPress,
      resource_type: "community",
      resource_id: community_id,
      operation_ref: operation_ref,
      contract_version: 1,
      dedupe_key: DedupeKey.encode([community_id, :config]),
      data: %{}
    })
  end

  @doc "Ensures replay of a completed config Command also has its durable invalidation intent."
  @spec ensure_invalidation(Community.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def ensure_invalidation(%Community{} = community, operation_ref) do
    if Repo.in_transaction?() do
      enqueue_invalidation(community, operation_ref)
    else
      Repo.transact_result(fn -> enqueue_invalidation(community, operation_ref) end)
    end
  end
end
