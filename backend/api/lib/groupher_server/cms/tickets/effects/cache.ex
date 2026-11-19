defmodule GroupherServer.CMS.Tickets.Effects.Cache do
  @moduledoc """
  Records and delivers cache invalidations for public Ticket projections.

      Ticket command or Post interaction
        -> Ticket tags + linked Post tags
        -> transactional CMS Outbox / post-commit purge
  """

  import Ecto.Query

  alias GroupherServer.{CMS, PublicCache, Repo}
  alias CMS.Model.{ArticleBinding, ArticleLifecycle, Community, TicketState}
  alias CMS.Tickets.Model.Source
  alias CMS.Outbox.DedupeKey

  @doc "Records fixed public Ticket and affected Post projection targets in the caller transaction."
  def projection_changed(
        %Community{id: community_id, slug: slug},
        %TicketState{type: :user, article_id: ticket_id, article_binding_id: binding_id},
        %ArticleBinding{
          id: binding_id,
          article_id: ticket_id,
          community_id: community_id,
          thread: :ticket,
          inner_id: inner_id
        },
        post_inner_ids,
        operation_ref
      )
      when is_integer(community_id) and is_binary(slug) and slug != "" and
             is_binary(ticket_id) and is_integer(binding_id) and is_integer(inner_id) and
             inner_id > 0 and is_list(post_inner_ids) and is_binary(operation_ref) do
    if Enum.all?(post_inner_ids, &(is_integer(&1) and &1 > 0)) do
      tags =
        [PublicCache.ticket_list_tag(slug), PublicCache.ticket_detail_tag(slug, inner_id)] ++
          post_tags(slug, post_inner_ids)

      tags
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.chunk_every(PublicCache.max_tags_per_request())
      |> Enum.with_index()
      |> Enum.reduce_while({:ok, []}, fn {batch, index}, {:ok, events} ->
        case CMS.Outbox.send(%{
               event: "ticket.cache_invalidation",
               worker: GroupherServer.Jobs.CMSOutboxTicket,
               resource_type: "ticket",
               resource_id: ticket_id,
               operation_ref: operation_ref,
               dedupe_key:
                 DedupeKey.encode([community_id, ticket_id, operation_ref, index | batch]),
               data: %{"cache_tags" => batch}
             }) do
          {:ok, event} -> {:cont, {:ok, [event | events]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    else
      {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
    end
  end

  def projection_changed(_community, _state, _binding, _post_inner_ids, _operation_ref) do
    {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
  end

  @doc "Purges public Ticket pages affected by a committed Post stats change."
  def purge_post(post_id) when is_binary(post_id) do
    rows =
      from(link in Source,
        join: state in TicketState,
        on: state.article_id == link.ticket_id and state.type == :user,
        join: lifecycle in ArticleLifecycle,
        on: lifecycle.article_id == state.article_id and lifecycle.thread == :ticket,
        join: ticket_binding in ArticleBinding,
        on: ticket_binding.id == state.article_binding_id,
        join: post_binding in ArticleBinding,
        on:
          post_binding.article_id == link.post_id and
            post_binding.community_id == ticket_binding.community_id,
        join: community in Community,
        on: community.id == ticket_binding.community_id,
        where: link.post_id == ^post_id and lifecycle.state == :published,
        select: {community.slug, ticket_binding.inner_id, post_binding.inner_id}
      )
      |> Repo.all()

    tags =
      Enum.flat_map(rows, fn {slug, ticket_inner_id, post_inner_id} ->
        [
          PublicCache.ticket_list_tag(slug),
          PublicCache.ticket_detail_tag(slug, ticket_inner_id)
        ] ++ post_tags(slug, [post_inner_id])
      end)
      |> Enum.uniq()

    case tags do
      [] ->
        {:ok, :pass}

      _ ->
        tags
        |> Enum.chunk_every(PublicCache.max_tags_per_request())
        |> Enum.reduce_while({:ok, :pass}, fn batch, {:ok, _result} ->
          case PublicCache.purge_tags(batch) do
            {:ok, result} -> {:cont, {:ok, result}}
            {:error, reason} -> {:halt, {:error, reason}}
          end
        end)
    end
  end

  def purge_post(_post_id), do: {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}

  defp post_tags(community, inner_ids) do
    Enum.flat_map(inner_ids, fn inner_id ->
      [
        PublicCache.article_detail_tag(community, :post, inner_id),
        PublicCache.article_list_tag(community, :post)
      ]
    end)
  end

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "ticket.cache_invalidation" -> CMS.Outbox.Event.project_fields(data, ["cache_tags"])
      _ -> {:error, {:outbox_event_owner_missing, event}}
    end
  end
end
