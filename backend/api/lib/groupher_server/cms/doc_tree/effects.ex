defmodule GroupherServer.CMS.DocTree.Effects do
  @moduledoc """
  Owns DocTree activity and post-commit invalidation intents.

      DocTree command/workflow
        -> tree facts and release state
        -> DocTree.Effects intent
        -> Activity / Outbox worker delivery
  """

  alias GroupherServer.{Activity, CMS}
  alias CMS.Model.Community
  alias CMS.Outbox.DedupeKey

  @doc "Records one DocTree activity while the caller owns the transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Records the community cache invalidation intent for a committed DocTree change."
  def enqueue_invalidation(%Community{} = community, operation_ref)
      when is_binary(operation_ref) do
    with {:ok, operation_ref} <- Ecto.UUID.cast(operation_ref),
         {:ok, _event} <-
           CMS.Outbox.send(%{
             event: "doc_tree.changed",
             worker: GroupherServer.Jobs.CMSOutboxCommunity,
             resource_type: "community",
             resource_id: community.id,
             operation_ref: operation_ref,
             dedupe_key: DedupeKey.encode([community.id]),
             data: %{community: community.slug, community_id: community.id}
           }) do
      {:ok, :pass}
    end
  end
end
