defmodule GroupherServer.CMS.Tickets.Query.Mentions do
  @moduledoc """
  Batch reads readable Ticket identities for mention confirmation.

      structured Ticket references -> Ticket Gate scope -> stable Ticket identities
  """
  import Ecto.Query, warn: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext
  alias CMS.Model.{ArticleBinding, Community, TicketState}

  def load(locators, ids) do
    pairs =
      case ids do
        [] ->
          []

        _ ->
          Repo.all(
            from(binding in ArticleBinding,
              where: binding.article_id in ^ids,
              select: {binding.article_id, binding.community_id, nil}
            )
          )
      end

    stable =
      pairs
      |> by_identity_pairs()
      |> Map.values()
      |> Enum.sort_by(&{&1.id, &1.community_id})
      |> Enum.reduce(%{}, fn article, acc -> Map.put_new(acc, {article.id, :stable}, article) end)

    Map.merge(articles(locators), stable)
  end

  def articles([]), do: %{}

  def articles(locators) do
    slugs = Enum.map(locators, fn {:article_path, slug, _} -> slug end) |> Enum.uniq()

    communities =
      Community
      |> where([community], community.slug in ^slugs)
      |> Repo.all()

    pairs =
      for community <- communities,
          {:article_path, slug, inner_id} = locator <- locators,
          community.slug == slug,
          do: {locator, community, inner_id}

    pairs
    |> Enum.group_by(fn {_locator, community, _inner_id} -> community.id end)
    |> Enum.reduce(%{}, fn {_community_id, rows}, acc ->
      {_locator, community, _inner_id} = hd(rows)
      inner_ids = Enum.map(rows, &elem(&1, 2))

      with {:ok, %Ecto.Query{} = query} <-
             CMS.Gate.scope(TicketState, nil, :list, TicketContext.public(community)) do
        tickets =
          from(
            [
              ticket_state: state,
              ticket_binding: binding,
              ticket_article: article,
              ticket_public: public
            ] in query,
            where: binding.inner_id in ^inner_ids,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: nil,
              thread: :ticket,
              inner_id: binding.inner_id,
              title: public.title
            }
          )
          |> Repo.all()

        Map.merge(
          acc,
          Map.new(tickets, fn ticket ->
            ticket =
              Map.merge(ticket, %{community_id: community.id, community_slug: community.slug})

            {{:article_path, community.slug, ticket.inner_id}, ticket}
          end)
        )
      else
        _ -> acc
      end
    end)
  end

  def by_identity_pairs([]), do: %{}

  def by_identity_pairs(pairs) do
    community_ids = pairs |> Enum.map(&elem(&1, 1)) |> Enum.uniq()
    communities = Repo.all(from(community in Community, where: community.id in ^community_ids))

    Enum.reduce(communities, %{}, fn community, resolved ->
      article_ids =
        pairs
        |> Enum.filter(&(elem(&1, 1) == community.id))
        |> Enum.map(&elem(&1, 0))
        |> Enum.uniq()

      with {:ok, %Ecto.Query{} = query} <-
             CMS.Gate.scope(TicketState, nil, :list, TicketContext.public(community)) do
        rows =
          from(
            [
              ticket_state: state,
              ticket_binding: binding,
              ticket_article: article,
              ticket_public: public
            ] in query,
            where: state.article_id in ^article_ids,
            select: %{
              id: article.id,
              article_id: article.id,
              branch_id: nil,
              thread: article.thread,
              inner_id: binding.inner_id,
              slug: nil,
              title: public.title
            }
          )
          |> Repo.all()

        Map.merge(
          resolved,
          Map.new(rows, fn row ->
            row = Map.merge(row, %{community_id: community.id, community_slug: community.slug})
            {{row.article_id, community.id, nil}, row}
          end)
        )
      else
        _ -> resolved
      end
    end)
  end
end
