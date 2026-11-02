defmodule GroupherServer.CMS.Review.Restrictions do
  @moduledoc """
  Orchestrates resource restrictions and source-linked Ticket consequences atomically.

      Resource Command -> Restrictions -> ReviewBlocks facts -> Ticket publication/cache
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, Community}
  alias CMS.ReviewBlocks

  @doc "Applies a restriction and its source visibility consequences in the caller transaction."
  def apply(lifecycle, attrs) do
    operation_ref = Map.get(attrs, :operation_ref) || Ecto.UUID.generate()

    with {:ok, _schema, target} <- ReviewBlocks.scope_target(lifecycle, attrs),
         {:ok, restriction} <-
           ReviewBlocks.apply(lifecycle, Map.put(attrs, :operation_ref, operation_ref)),
         {:ok, :pass} <-
           hold_tickets_linked_to_review_block(
             lifecycle,
             target,
             Map.get(attrs, :actor),
             operation_ref
           ) do
      {:ok, restriction}
    end
  end

  @doc "Resolves restrictions and reconciles every affected projection in the caller transaction."
  def end_blocks(lifecycle, scope_key, ids, operation_ref, resolution) do
    with {:ok, _schema, target} <- ReviewBlocks.scope_target(lifecycle, %{scope_key: scope_key}),
         {:ok, :pass} <-
           ReviewBlocks.end_blocks(lifecycle, scope_key, ids, operation_ref, resolution),
         {:ok, :pass} <- reconcile_ticket_review_block(lifecycle, target, nil, operation_ref) do
      {:ok, :pass}
    end
  end

  defp hold_tickets_linked_to_review_block(
         %ArticleLifecycle{article_id: article_id},
         %{community_id: community_id},
         actor,
         operation_ref
       ) do
    case Repo.get(Article, article_id) do
      %Article{thread: :post} ->
        article_bindings_query =
          from(binding in ArticleBinding,
            where: binding.article_id == ^article_id,
            select: binding.community_id,
            distinct: true,
            order_by: binding.community_id
          )

        article_bindings_query =
          if is_nil(community_id) do
            article_bindings_query
          else
            where(article_bindings_query, [binding], binding.community_id == ^community_id)
          end

        community_ids = Repo.all(article_bindings_query)

        Enum.reduce_while(community_ids, {:ok, :pass}, fn community_id, {:ok, :pass} ->
          case Repo.get(Community, community_id) do
            %Community{} = community ->
              case CMS.Tickets.PostVisibility.reconcile_in_transaction(
                     community,
                     article_id,
                     actor,
                     operation_ref,
                     "post_review_block"
                   ) do
                {:ok, :pass} -> {:cont, {:ok, :pass}}
                {:error, reason} -> {:halt, {:error, reason}}
              end

            nil ->
              {:halt, {:error, CMS.ErrorCat.lifecycle_not_found()}}
          end
        end)

      %Article{thread: :ticket} = article ->
        case ticket_community(article.id) do
          %Community{} = community ->
            case CMS.Tickets.Publication.reconcile_restrictions_in_transaction(
                   community,
                   article.id,
                   actor,
                   operation_ref,
                   "ticket_review_block_applied:#{article.id}"
                 ) do
              {:ok, _lifecycle} -> {:ok, :pass}
              {:error, reason} -> {:error, reason}
            end

          nil ->
            {:error, CMS.ErrorCat.lifecycle_not_found()}
        end

      %Article{} ->
        {:ok, :pass}

      nil ->
        {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp hold_tickets_linked_to_review_block(_lifecycle, _target, _actor, _operation_ref) do
    {:ok, :pass}
  end

  defp reconcile_ticket_review_block(
         %ArticleLifecycle{article_id: article_id},
         target,
         actor,
         operation_ref
       ) do
    case Repo.get(Article, article_id) do
      %Article{thread: :ticket} = article ->
        case ticket_community(article.id) do
          %Community{} = community ->
            case CMS.Tickets.Publication.reconcile_restrictions_in_transaction(
                   community,
                   article.id,
                   actor,
                   operation_ref,
                   "ticket_review_block_resolved:#{article.id}"
                 ) do
              {:ok, _lifecycle} -> {:ok, :pass}
              {:error, reason} -> {:error, reason}
            end

          nil ->
            {:error, CMS.ErrorCat.lifecycle_not_found()}
        end

      %Article{thread: :post} ->
        invalidate_linked_post_tickets(article_id, Map.get(target, :community_id), operation_ref)

      %Article{} ->
        {:ok, :pass}

      nil ->
        {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp reconcile_ticket_review_block(_lifecycle, _target, _actor, _operation_ref) do
    {:ok, :pass}
  end

  defp invalidate_linked_post_tickets(article_id, community_id, operation_ref) do
    article_bindings_query =
      from(binding in ArticleBinding,
        where: binding.article_id == ^article_id,
        select: binding.community_id,
        distinct: true,
        order_by: binding.community_id
      )

    article_bindings_query =
      if is_nil(community_id) do
        article_bindings_query
      else
        where(article_bindings_query, [binding], binding.community_id == ^community_id)
      end

    article_bindings_query
    |> Repo.all()
    |> Enum.reduce_while({:ok, :pass}, fn community_id, {:ok, :pass} ->
      case Repo.get(Community, community_id) do
        %Community{} = community ->
          case CMS.Tickets.PostVisibility.reconcile_in_transaction(
                 community,
                 article_id,
                 nil,
                 operation_ref,
                 "ticket_review_block_resolved"
               ) do
            {:ok, :pass} -> {:cont, {:ok, :pass}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        nil ->
          {:halt, {:error, CMS.ErrorCat.lifecycle_not_found()}}
      end
    end)
  end

  defp ticket_community(article_id) do
    from(binding in ArticleBinding,
      join: community in Community,
      on: community.id == binding.community_id,
      where: binding.article_id == ^article_id,
      order_by: [asc: binding.id],
      limit: 1,
      select: community
    )
    |> Repo.one()
  end
end
