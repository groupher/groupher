defmodule GroupherServer.CMS.Gate.Scope.Ticket do
  @moduledoc """
  Applies Community membership, Ticket visibility and actor policy to read queries.

      Ticket query + typed context + actor
        -> Ticket Gate policy
        -> Community-scoped public or internal result
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext
  alias CMS.Gate.ErrorCat

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic
  }

  alias Accounts.Model.User

  @actions [:read, :list]

  @doc "Applies Community, visibility, and actor admission to a Ticket query."
  def scope(%Ecto.Query{} = query, actor, action, %TicketContext{} = context)
      when action in @actions do
    case context.visibility do
      :public -> {:ok, public_scope(query, context)}
      :internal -> internal_scope(query, actor, context)
      _ -> {:error, ErrorCat.scope_context_missing()}
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, ErrorCat.scope_context_missing()}

  defp public_scope(query, %TicketContext{community_id: community_id}) do
    public_articles =
      from(article in Article, where: article.thread == :ticket)
      |> CMS.Gate.Scope.Article.public_identity(:ticket)
      |> where([gate_community: community], community.id == ^community_id)
      |> select([article], article.id)

    query = from(state in query, as: :ticket_state)

    query
    |> join(:inner, [ticket_state: state], binding in ArticleBinding,
      on: binding.id == state.article_binding_id and binding.community_id == ^community_id,
      as: :ticket_binding
    )
    |> join(:inner, [ticket_state: state], article in Article,
      on: article.id == state.article_id and article.thread == :ticket,
      as: :ticket_article
    )
    |> join(:inner, [ticket_article: article], lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.thread == :ticket,
      as: :ticket_lifecycle
    )
    |> join(:inner, [ticket_article: article], public in ArticlePublic,
      on: public.article_id == article.id,
      as: :ticket_public
    )
    |> where(
      [ticket_state: state],
      state.type == :user and as(:ticket_lifecycle).state == :published
    )
    |> where([ticket_state: state], state.article_id in subquery(public_articles))
  end

  defp internal_scope(query, %User{} = actor, %TicketContext{} = context) do
    rules = Map.get(actor, :cur_passport)

    if CMS.Passport.Authorization.allowed?(
         rules,
         context.community_slug,
         CMS.GateAction.ticket_read_internal()
       ) ==
         {:ok, true} do
      query = from(state in query, as: :ticket_state)

      {:ok,
       query
       |> join(:inner, [ticket_state: state], binding in ArticleBinding,
         on:
           binding.id == state.article_binding_id and
             binding.community_id == ^context.community_id,
         as: :ticket_binding
       )
       |> join(:inner, [ticket_state: state], article in Article,
         on: article.id == state.article_id and article.thread == :ticket,
         as: :ticket_article
       )}
    else
      {:error, ErrorCat.permission_denied()}
    end
  end

  defp internal_scope(_query, _actor, _context), do: {:error, ErrorCat.permission_denied()}
end
