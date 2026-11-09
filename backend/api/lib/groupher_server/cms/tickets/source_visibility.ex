defmodule GroupherServer.CMS.Tickets.SourceVisibility do
  @moduledoc """
  Reconciles Ticket publication eligibility and cache effects when a linked Post
  or its Community changes public readability.

  Callers own the surrounding transaction and must invoke this after the
  Article/Community visibility fact has been written.

      Post or Community visibility change
        -> Article Gate public scope
        -> Ticket lifecycle reconcile and cache Outbox
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleBinding, Community}
  alias CMS.Tickets.{Persist, Model.Source, PublicPosts}

  @doc "Reconciles all User Tickets linked to a Post after its visibility changes."
  def update_in_transaction(
        post_id,
        %Community{} = community,
        actor,
        visibility_cause,
        operation_ref
      )
      when is_binary(post_id) and is_atom(visibility_cause) and is_binary(operation_ref) do
    cause = CMS.Tickets.Const.cause_value(visibility_cause)

    with true <- Repo.in_transaction?(),
         {:ok, public?} <- PublicPosts.public?(community.id, post_id),
         {:ok, :pass} <-
           recheck_visibility(public?, post_id, community, actor, cause, operation_ref) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
    end
  end

  def update_in_transaction(
        _post_id,
        _community,
        _actor,
        _visibility_cause,
        _operation_ref
      ) do
    {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
  end

  @doc "Reconciles every Community binding after a global Post visibility change."
  def update_all_in_transaction(post_id, actor, visibility_cause, operation_ref)
      when is_binary(post_id) and is_atom(visibility_cause) and is_binary(operation_ref) do
    with true <- Repo.in_transaction?() do
      communities = linked_to(post_id)

      Enum.reduce_while(communities, {:ok, :pass}, fn community, _ ->
        case update_in_transaction(post_id, community, actor, visibility_cause, operation_ref) do
          {:ok, _} -> {:cont, {:ok, :pass}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
    end
  end

  @doc "Reconciles linked Tickets after the Community public-readability boundary changes."
  def update_community_in_transaction(%Community{} = community, actor, operation_ref)
      when is_binary(operation_ref) do
    with true <- Repo.in_transaction?() do
      post_ids =
        from(source in Source,
          join: binding in ArticleBinding,
          on: binding.article_id == source.ticket_id and binding.community_id == ^community.id,
          where: source.type == :post,
          distinct: true,
          order_by: [asc: source.post_id],
          select: source.post_id
        )
        |> Repo.all()

      locked_post_ids =
        from(article in Article,
          where: article.id in ^post_ids and article.thread == :post,
          order_by: [asc: article.id],
          lock: "FOR UPDATE",
          select: article.id
        )
        |> Repo.all()

      Enum.reduce_while(locked_post_ids, {:ok, :pass}, fn post_id, {:ok, :pass} ->
        case update_in_transaction(
               post_id,
               community,
               actor,
               :community_visibility,
               operation_ref
             ) do
          {:ok, _result} -> {:cont, {:ok, :pass}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
    end
  end

  def update_community_in_transaction(_community, _actor, _operation_ref) do
    {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
  end

  @doc "Invalidates Ticket and Post cache tags after a newly selected Post revision."
  def revalidate_cache_in_transaction(post_id, identity, effect_key)
      when is_binary(post_id) and is_tuple(identity) and is_binary(effect_key) do
    with true <- Repo.in_transaction?() do
      community_ids =
        from(source in Source,
          join: binding in ArticleBinding,
          on: binding.article_id == source.ticket_id,
          where: source.type == :post and source.post_id == ^post_id,
          distinct: true,
          order_by: [asc: binding.community_id],
          select: binding.community_id
        )
        |> Repo.all()

      Enum.reduce_while(community_ids, {:ok, :pass}, fn community_id, {:ok, :pass} ->
        case Repo.get(Community, community_id) do
          %Community{} = community ->
            case Persist.invalidate_cache_linked_to_post(
                   community,
                   post_id,
                   identity,
                   "#{effect_key}:#{community.id}"
                 ) do
              {:ok, _result} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end

          nil ->
            {:halt, {:error, CMS.Communities.ErrorCat.not_exist()}}
        end
      end)
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
    end
  end

  def revalidate_cache_in_transaction(_post_id, _identity, _effect_key) do
    {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
  end

  defp linked_to(post_id) do
    Repo.all(
      from(binding in ArticleBinding,
        join: community in Community,
        on: community.id == binding.community_id,
        where: binding.article_id == ^post_id,
        order_by: community.id,
        select: community
      )
    )
  end

  defp recheck_visibility(true, post_id, community, _actor, cause, operation_ref) do
    cache_revalidate(
      community,
      post_id,
      operation_ref,
      "ticket_post_visibility:#{cause}:#{post_id}"
    )
  end

  defp recheck_visibility(false, post_id, community, actor, cause, operation_ref) do
    Persist.hold_linked_to_post(community, post_id, actor, operation_ref, cause)
  end

  defp cache_revalidate(community, post_id, operation_ref, effect_key) do
    case Persist.invalidate_cache_linked_to_post(community, post_id, operation_ref, effect_key) do
      {:ok, _result} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end
end
