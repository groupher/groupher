defmodule GroupherServer.CMS.Communities.Tags.Effects do
  @moduledoc """
  Owns durable taxonomy invalidation intents for Community Tags.

  Tag mutation and maintenance callers provide the identity and retain
  transaction ownership; delivery is performed by the shared Community
  cleanup worker after commit.

      Tag Command / maintenance workflow
        -> Tags.Effects
        -> CMS.Outbox
        -> Community cleanup worker
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  alias CMS.Outbox.DedupeKey

  @doc "Records one taxonomy invalidation in the caller-owned transaction."
  @spec enqueue_taxonomy_changed(Community.t(), atom(), Ecto.UUID.t(), term()) ::
          {:ok, CMS.Outbox.Event.t()} | {:error, term()}
  def enqueue_taxonomy_changed(%Community{} = community, thread, operation_ref, effect_dimensions)
      when is_atom(thread) and is_binary(operation_ref) do
    CMS.Outbox.send(%{
      event: "community.taxonomy_changed",
      worker: GroupherServer.Jobs.CMSOutboxCommunity,
      resource_type: "community",
      resource_id: community.id,
      operation_ref: operation_ref,
      dedupe_key: DedupeKey.encode([community.id, thread, effect_dimensions]),
      data: %{community: community.slug, community_id: community.id, thread: thread}
    })
  end
end
