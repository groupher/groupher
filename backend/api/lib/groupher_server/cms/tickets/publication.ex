defmodule GroupherServer.CMS.Tickets.Publication do
  @moduledoc """
  Captures the source revisions and public Updates reviewed for one publication.

      Internal read -> ephemeral preview anchor -> locked Publish comparison
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticlePublic, TicketUpdate}
  alias CMS.Tickets.Model.Source

  @doc "Reconciles a Ticket review change in the caller's existing resource transaction."
  defdelegate reconcile_restrictions_in_transaction(
                community,
                ticket_id,
                actor,
                operation_ref,
                effect_key
              ), to: CMS.Tickets.Persist, as: :review_block_changed

  @doc "Hashes the currently visible source heads and effective PUBLIC Updates without persisting a version."
  def preview_anchor(community_id, ticket_id) do
    Map.fetch!(preview_anchors(community_id, [ticket_id]), ticket_id)
  end

  @doc "Builds all preview anchors with two set-based queries for an internal page."
  def preview_anchors(community_id, ticket_ids) do
    {:ok, visible} = CMS.Tickets.PublicPosts.ids_query(community_id)

    sources =
      Repo.all(
        from(source in Source,
          join: public in ArticlePublic,
          on: public.article_id == source.post_id,
          where: source.ticket_id in ^ticket_ids and source.post_id in subquery(visible),
          order_by: source.id,
          select: {source.ticket_id, {source.id, source.post_id, public.revision_id}}
        )
      )
      |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

    updates =
      Repo.all(
        from(update in TicketUpdate,
          left_join: replacement in TicketUpdate,
          on: replacement.supersedes_id == update.id,
          where:
            update.ticket_id in ^ticket_ids and update.visibility == :public and
              is_nil(replacement.id),
          order_by: update.id,
          select: {update.ticket_id, update.id}
        )
      )
      |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

    Map.new(ticket_ids, fn id ->
      fingerprint =
        :crypto.hash(
          :sha256,
          :erlang.term_to_binary({Map.get(sources, id, []), Map.get(updates, id, [])})
        )
        |> Base.encode16(case: :lower)

      {id, fingerprint}
    end)
  end
end
