defmodule GroupherServer.CMS.Tickets.Query do
  @moduledoc """
  Reads User, Worker and Case Tickets through the dedicated Ticket Gate scope.

  This query surface never routes `:ticket` through ordinary Article list or
  search infrastructure. Public results contain only User Tickets; internal
  results require `ticket.read_internal` admission.

      Ticket read request
        -> Ticket Gate scope
        -> Article revision and Ticket relation projections
        -> public or authorized internal result
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Pagi, Repo}
  alias GroupherServer.Activity
  alias Activity.Model.TicketLog
  alias CMS.Gate.Context.Scope.Ticket, as: TicketContext

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleDraft,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    ArticleReviewBlock,
    CommunityTag,
    TicketCaseMember,
    TicketCaseWorker,
    TicketAssignee,
    TicketFacet,
    TicketState,
    TicketTag,
    TicketUpdate,
    TicketWorker
  }

  alias CMS.Tickets.{ErrorCat, Model.Source}

  @default_size 20
  @max_size 100

  @doc "Loads a source Post through the canonical public Gate. The caller owns mutation locks."
  def source_post(community, post_id) do
    scope = CMS.Gate.Context.Scope.Article.public(:post)

    with {:ok, public_post_ids} <- CMS.Tickets.PublicPosts.ids_query(community.id),
         %Ecto.Query{} = query <- CMS.Gate.scope(Article, nil, :read, scope),
         %Article{} = post <-
           query
           |> where(
             [article, ...],
             article.id == ^post_id and as(:gate_community).id == ^community.id and
               article.id in subquery(public_post_ids)
           )
           |> Repo.one(),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, post.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id),
         {:ok, %ArticleBinding{} = binding} <-
           CMS.Articles.Bindings.fetch_binding(post.id, community.id),
         true <- post.thread == :post do
      {:ok, post, public, revision, binding}
    else
      _ -> {:error, ErrorCat.post_not_public()}
    end
  end

  @doc "Returns one internal Ticket after Community Gate admission."
  def get_internal(community, ticket_id, actor) do
    with {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, actor, :read, TicketContext.internal(community)),
         %TicketState{} = state <-
           query
           |> where([ticket_state: state], state.article_id == ^ticket_id)
           |> Repo.one() do
      {:ok, hd(internal_entries([state], community))}
    else
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Returns a public User Ticket by its Community-shared Article number."
  def get_public(community, inner_id) when is_integer(inner_id) do
    with {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, nil, :read, TicketContext.public(community)),
         %TicketState{} = state <-
           query
           |> where([ticket_state: _state], as(:ticket_binding).inner_id == ^inner_id)
           |> Repo.one() do
      {:ok, hd(public_entries([state], community))}
    else
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Pages internal Ticket Activity after Ticket Gate admission."
  def activity_internal(community, ticket_id, actor, pagi \\ nil) do
    with {:ok, page, size} <- offset_position(pagi),
         {:ok, %Ecto.Query{} = scope} <-
           CMS.Gate.scope(TicketState, actor, :read, TicketContext.internal(community)),
         %TicketState{} <-
           scope
           |> where([ticket_state: state], state.article_id == ^ticket_id)
           |> Repo.one() do
      query = from(log in TicketLog, where: log.article_id == ^ticket_id)
      total_count = Repo.aggregate(query, :count, :id)

      entries =
        query
        |> order_by([log], desc: log.occurred_at, desc: log.record_sequence)
        |> limit(^size)
        |> offset(^((page - 1) * size))
        |> Repo.all()
        |> Enum.map(fn log ->
          %{
            id: log.event_ref,
            action: log.action,
            payload: log.payload,
            occurred_at: log.occurred_at,
            actor_ref: log.actor_ref
          }
        end)

      {:ok, %{entries: entries, page_info: page_info(page, size, total_count)}}
    else
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Pages public User Tickets in a stable state/rank/identity order."
  def page_public(community, filter \\ %{}, pagi \\ nil) do
    with {:ok, page, size} <- offset_position(pagi),
         {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, nil, :list, TicketContext.public(community)),
         query <- apply_public_filter(query, filter),
         total_count <- Repo.aggregate(query, :count, :article_id),
         states <-
           query
           |> order_by([ticket_state: state],
             asc: state.rank,
             desc: as(:ticket_public).published_at,
             asc: state.article_id
           )
           |> limit(^size)
           |> offset(^((page - 1) * size))
           |> Repo.all() do
      entries = public_entries(states, community)
      total_pages = if total_count == 0, do: 0, else: div(total_count + size - 1, size)

      {:ok,
       %{
         entries: entries,
         page_info: %{
           api: :offset,
           page: page,
           size: size,
           total_count: total_count,
           total_pages: total_pages,
           has_previous_page: page > 1,
           has_next_page: page < total_pages
         }
       }}
    else
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Groups the configured public Kanban columns from Ticket facts."
  def grouped_public(community, pagi \\ nil) do
    Enum.reduce_while([:todo, :wip, :done], {:ok, %{}}, fn status, {:ok, columns} ->
      case page_public(community, %{status: status}, pagi) do
        {:ok, page} -> {:cont, {:ok, Map.put(columns, status, page)}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  @doc "Groups internal User Tickets after Ticket Gate admission."
  def grouped_internal(community, actor, pagi \\ nil) do
    grouped_internal(community, actor, pagi, %{})
  end

  def grouped_internal(community, actor, pagi, filter) do
    Enum.reduce_while([:todo, :wip, :done], {:ok, %{}}, fn status, {:ok, columns} ->
      case page_internal(community, actor, Map.put(filter, :status, status), pagi) do
        {:ok, page} -> {:cont, {:ok, Map.put(columns, status, page)}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  @doc "Pages internal User Tickets after Community and Ticket Gate filtering."
  def page_internal(community, actor, filter \\ %{}, pagi \\ nil) do
    with {:ok, page, size} <- offset_position(pagi),
         {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, actor, :list, TicketContext.internal(community)),
         query <- apply_internal_filter(query, community.id, filter),
         total_count <- Repo.aggregate(query, :count, :article_id),
         states <-
           query
           |> join_internal_content()
           |> order_by([ticket_state: state],
             asc: state.rank,
             asc: as(:ticket_draft).title,
             desc: as(:ticket_public).published_at,
             asc: state.article_id
           )
           |> limit(^size)
           |> offset(^((page - 1) * size))
           |> Repo.all() do
      {:ok,
       %{
         entries: internal_entries(states, community),
         page_info: page_info(page, size, total_count)
       }}
    else
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Searches internal Ticket titles by a normalized PostgreSQL prefix."
  def search_internal(community, query_text, actor, pagi \\ nil, type \\ nil)
      when is_binary(query_text) do
    query_text = query_text |> String.trim() |> String.downcase()

    with true <- query_text != "",
         {:ok, page, size} <- offset_position(pagi),
         {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, actor, :list, TicketContext.internal(community)),
         query <-
           query
           |> join_internal_content()
           |> apply_internal_search(query_text)
           |> maybe_filter_type(type),
         total_count <- Repo.aggregate(query, :count, :article_id),
         states <- query |> limit(^size) |> offset(^((page - 1) * size)) |> Repo.all() do
      {:ok,
       %{
         entries: internal_entries(states, community),
         page_info: page_info(page, size, total_count)
       }}
    else
      false -> {:ok, %{entries: [], page_info: page_info(1, @default_size, 0)}}
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  @doc "Returns current public Ticket progress for each supplied Post Community number."
  def post_progress(community, post_inner_ids)
      when is_list(post_inner_ids) and length(post_inner_ids) <= 100 do
    post_inner_ids = Enum.uniq(post_inner_ids)

    case post_inner_ids do
      [] ->
        {:ok, %{}}

      ids ->
        with {:ok, %Ecto.Query{} = scope} <-
               CMS.Gate.scope(TicketState, nil, :list, TicketContext.public(community)),
             {:ok, public_post_ids} <- CMS.Tickets.PublicPosts.ids_query(community.id),
             rows <-
               scope
               |> join(:inner, [ticket_state: state], link in Source,
                 on: link.ticket_id == state.article_id,
                 as: :ticket_post_link
               )
               |> join(:inner, [ticket_post_link: link], binding in ArticleBinding,
                 on:
                   binding.article_id == link.post_id and
                     binding.community_id == ^community.id,
                 as: :post_binding
               )
               |> join(:inner, [post_binding: binding], public in ArticlePublic,
                 on: public.article_id == binding.article_id,
                 as: :post_public
               )
               |> join(:inner, [ticket_public: public], revision in ArticleRevision,
                 on: revision.id == public.revision_id,
                 as: :ticket_revision
               )
               |> where([post_binding: binding], binding.inner_id in ^ids)
               |> where([ticket_post_link: link], link.post_id in subquery(public_post_ids))
               |> select([ticket_state: state], %{
                 post_inner_id: as(:post_binding).inner_id,
                 ticket_id: state.article_id,
                 status: state.status,
                 title: as(:ticket_revision).title,
                 inner_id: as(:ticket_binding).inner_id
               })
               |> Repo.all() do
          grouped = Enum.group_by(rows, & &1.post_inner_id)

          {:ok,
           Map.new(grouped, fn {post_id, tickets} ->
             completed = Enum.count(tickets, &(&1.status == :done))
             total = length(tickets)

             status =
               cond do
                 completed == total -> :done
                 Enum.all?(tickets, &(&1.status == :todo)) -> :todo
                 true -> :wip
               end

             {post_id,
              %{
                status: status,
                completed: completed,
                total: total,
                tickets:
                  Enum.map(tickets, fn ticket ->
                    %{
                      id: to_string(ticket.inner_id),
                      inner_id: ticket.inner_id,
                      title: ticket.title,
                      status: ticket.status
                    }
                  end)
              }}
           end)}
        end
    end
  end

  def post_progress(_community, _post_inner_ids), do: {:error, ErrorCat.invalid_ticket_content()}

  @doc "Returns current public Ticket targets for Article Activity within one Community."
  def public_activity_targets(community, ticket_ids)
      when is_list(ticket_ids) and length(ticket_ids) <= 20 do
    case Enum.uniq(ticket_ids) do
      [] ->
        {:ok, %{}}

      ids ->
        with {:ok, %Ecto.Query{} = scope} <-
               CMS.Gate.scope(TicketState, nil, :read, TicketContext.public(community)) do
          targets =
            scope
            |> where([ticket_state: state], state.article_id in ^ids)
            |> select([ticket_state: state], %{
              article_id: state.article_id,
              inner_id: as(:ticket_binding).inner_id,
              title: as(:ticket_public).title
            })
            |> Repo.all()
            |> Map.new(fn ticket ->
              {ticket.article_id,
               %{
                 type: :ticket,
                 ref: ticket.article_id,
                 title: ticket.title,
                 inner_id: ticket.inner_id,
                 url:
                   CMS.FrontDesk.article_url(%{
                     community_slug: community.slug,
                     thread: :ticket,
                     inner_id: ticket.inner_id
                   })
               }}
            end)

          {:ok, targets}
        end
    end
  end

  def public_activity_targets(_community, _ticket_ids) do
    {:error, ErrorCat.invalid_ticket_content()}
  end

  @doc "Returns internal User Tickets linked to one Post after Ticket Gate admission."
  def linked_to_post_internal(community, post_id, actor) when is_binary(post_id) do
    with {:ok, %Ecto.Query{} = query} <-
           CMS.Gate.scope(TicketState, actor, :list, TicketContext.internal(community)),
         true <- post_exists_in_community?(post_id, community.id),
         states <-
           query
           |> join(:inner, [ticket_state: state], link in Source,
             on: link.ticket_id == state.article_id,
             as: :ticket_post_link
           )
           |> where(
             [ticket_state: state, ticket_post_link: link],
             state.type == :user and link.post_id == ^post_id
           )
           |> order_by([ticket_state: state], asc: state.article_id)
           |> Repo.all() do
      {:ok, internal_entries(states, community)}
    else
      false -> {:error, ErrorCat.not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.not_found()}
    end
  end

  def linked_to_post_internal(_community, _post_id, _actor) do
    {:error, ErrorCat.invalid_ticket_content()}
  end

  defp public_entries(states, community), do: entries(states, community, true)
  defp internal_entries(states, community), do: entries(states, community, false)

  defp entries([], _community, _public?), do: []

  defp entries(states, community, public?) do
    ids = Enum.map(states, & &1.article_id)
    binding_ids = Enum.map(states, & &1.article_binding_id)

    articles =
      Repo.all(from(article in Article, where: article.id in ^ids))
      |> Map.new(&{&1.id, &1})

    bindings =
      Repo.all(from(binding in ArticleBinding, where: binding.id in ^binding_ids))
      |> Map.new(&{&1.id, &1})

    publics =
      Repo.all(from(public in ArticlePublic, where: public.article_id in ^ids))
      |> Map.new(&{&1.article_id, &1})

    lifecycles =
      Repo.all(from(lifecycle in ArticleLifecycle, where: lifecycle.article_id in ^ids))
      |> Map.new(&{&1.article_id, &1})

    ticket_review_block_ids =
      if public? do
        MapSet.new()
      else
        Repo.all(
          from(block in ArticleReviewBlock,
            where: block.article_id in ^ids and is_nil(block.resolved_at),
            select: block.article_id,
            distinct: true
          )
        )
        |> MapSet.new()
      end

    drafts =
      if public? do
        %{}
      else
        Repo.all(from(draft in ArticleDraft, where: draft.article_id in ^ids))
        |> Map.new(&{&1.article_id, &1})
      end

    revision_ids = publics |> Map.values() |> Enum.map(& &1.revision_id)

    revisions =
      Repo.all(from(revision in ArticleRevision, where: revision.id in ^revision_ids))
      |> Map.new(&{&1.id, &1})

    body_snapshot_ids = Enum.map(Map.values(revisions), & &1.body_snapshot_id)

    public_bodies =
      Repo.all(from(body in ArticleBodySnapshot, where: body.id in ^body_snapshot_ids))
      |> Map.new(&{&1.id, &1})

    draft_body_ids = drafts |> Map.values() |> Enum.map(& &1.body_draft_id)

    draft_bodies =
      Repo.all(from(body in ArticleBodyDraft, where: body.id in ^draft_body_ids))
      |> Map.new(&{&1.id, &1})

    post_refs = post_refs_by_ticket(ids, community.id, public?)

    relations = related_records(ids, public?)

    previews =
      if public?, do: %{}, else: CMS.Tickets.Publication.preview_anchors(community.id, ids)

    Enum.map(states, fn state ->
      article = Map.fetch!(articles, state.article_id)
      binding = Map.fetch!(bindings, state.article_binding_id)
      public = Map.get(publics, state.article_id)
      revision = public && Map.get(revisions, public.revision_id)
      draft = Map.get(drafts, state.article_id)
      draft_body = draft && Map.get(draft_bodies, draft.body_draft_id)
      public_body = revision && Map.get(public_bodies, revision.body_snapshot_id)
      body = if draft, do: draft_body, else: public_body

      lifecycle = Map.get(lifecycles, state.article_id)

      result =
        entry(
          state,
          article,
          binding,
          community,
          lifecycle,
          draft,
          revision,
          body,
          draft_body,
          public_body
        )
        |> Map.put(
          :can_publish_public_updates,
          state.type == :user and not is_nil(lifecycle) and lifecycle.state == :published and
            not MapSet.member?(ticket_review_block_ids, state.article_id)
        )

      result =
        if public? do
          result
          |> Map.put(:id, to_string(binding.inner_id))
          |> Map.put(:public, true)
          |> Map.put(:public_query, true)
          |> Map.put(:lifecycle_version, nil)
          |> Map.put(:workflow_version, nil)
          |> Map.put(:draft_version, nil)
          |> Map.put(:draft_content, nil)
          |> Map.put(:has_unpublished_changes, nil)
        else
          result
        end

      result
      |> Map.put(
        :publication_preview,
        Map.get(previews, state.article_id)
      )
      |> Map.put(:sources, Map.get(post_refs, state.article_id, []))
      |> Map.merge(Map.get(relations, state.article_id, empty_relations()))
    end)
  end

  defp related_records(ticket_ids, public?) do
    empty = Map.new(ticket_ids, &{&1, empty_relations()})

    updates_query =
      from(update in TicketUpdate,
        left_join: replacement in TicketUpdate,
        on: replacement.supersedes_id == update.id,
        where: update.ticket_id in ^ticket_ids,
        order_by: [desc: update.inserted_at]
      )

    updates_query =
      if public? do
        where(
          updates_query,
          [update, replacement],
          update.visibility == :public and is_nil(replacement.id)
        )
      else
        updates_query
      end

    updates =
      updates_query
      |> Repo.all()
      |> Enum.group_by(& &1.ticket_id, & &1)

    if public? do
      Map.new(ticket_ids, fn id ->
        {id, Map.put(Map.fetch!(empty, id), :updates, Map.get(updates, id, []))}
      end)
    else
      workers =
        from(relation in TicketWorker,
          join: state in TicketState,
          on: state.article_id == relation.worker_ticket_id,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          left_join: draft in ArticleDraft,
          on: draft.article_id == state.article_id,
          left_join: public in ArticlePublic,
          on: public.article_id == state.article_id,
          left_join: revision in ArticleRevision,
          on: revision.id == public.revision_id,
          where: relation.parent_ticket_id in ^ticket_ids,
          order_by: [asc: state.rank, asc: state.article_id],
          select: {relation.parent_ticket_id, state, draft, revision, binding}
        )
        |> Repo.all()
        |> Enum.map(fn {parent_id, state, draft, revision, binding} ->
          {parent_id, ticket_ref(state, draft, revision, binding)}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      assignees =
        from(assignee in TicketAssignee,
          join: user in GroupherServer.Accounts.Model.User,
          on: user.id == assignee.user_id,
          where: assignee.ticket_id in ^ticket_ids,
          order_by: [asc: user.login, asc: user.id],
          select: {assignee.ticket_id, user}
        )
        |> Repo.all()
        |> Enum.map(fn {ticket_id, user} ->
          {ticket_id, %{id: to_string(user.id), login: user.login, nickname: user.nickname}}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      tags =
        from(ticket_tag in TicketTag,
          join: tag in CommunityTag,
          on: tag.id == ticket_tag.community_tag_id,
          where: ticket_tag.ticket_id in ^ticket_ids,
          order_by: [asc: tag.title, asc: tag.id],
          select: {ticket_tag.ticket_id, tag}
        )
        |> Repo.all()
        |> Enum.map(fn {ticket_id, tag} ->
          {ticket_id,
           %{
             id: tag.id,
             title: tag.title,
             slug: tag.slug,
             color: if(tag.color, do: Atom.to_string(tag.color), else: nil)
           }}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      facets =
        from(facet in TicketFacet,
          where: facet.ticket_id in ^ticket_ids,
          order_by: [asc: facet.key, asc: facet.value],
          select: {facet.ticket_id, %{key: facet.key, value: facet.value}}
        )
        |> Repo.all()
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      members =
        from(relation in TicketCaseMember,
          join: state in TicketState,
          on: state.article_id == relation.user_ticket_id,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          left_join: draft in ArticleDraft,
          on: draft.article_id == state.article_id,
          left_join: public in ArticlePublic,
          on: public.article_id == state.article_id,
          left_join: revision in ArticleRevision,
          on: revision.id == public.revision_id,
          where: relation.case_ticket_id in ^ticket_ids,
          order_by: [asc: state.rank, asc: state.article_id],
          select: {relation.case_ticket_id, state, draft, revision, binding}
        )
        |> Repo.all()
        |> Enum.map(fn {case_id, state, draft, revision, binding} ->
          {case_id, ticket_ref(state, draft, revision, binding)}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      cases =
        from(relation in TicketCaseMember,
          join: state in TicketState,
          on: state.article_id == relation.case_ticket_id,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          left_join: draft in ArticleDraft,
          on: draft.article_id == state.article_id,
          left_join: public in ArticlePublic,
          on: public.article_id == state.article_id,
          left_join: revision in ArticleRevision,
          on: revision.id == public.revision_id,
          where: relation.user_ticket_id in ^ticket_ids,
          order_by: [asc: state.rank, asc: state.article_id],
          select: {relation.user_ticket_id, state, draft, revision, binding}
        )
        |> Repo.all()
        |> Enum.map(fn {user_id, state, draft, revision, binding} ->
          {user_id, ticket_ref(state, draft, revision, binding)}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      shared_workers =
        from(relation in TicketCaseWorker,
          join: state in TicketState,
          on: state.article_id == relation.worker_ticket_id,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          left_join: draft in ArticleDraft,
          on: draft.article_id == state.article_id,
          left_join: public in ArticlePublic,
          on: public.article_id == state.article_id,
          left_join: revision in ArticleRevision,
          on: revision.id == public.revision_id,
          where: relation.case_ticket_id in ^ticket_ids,
          order_by: [asc: state.rank, asc: state.article_id],
          select: {relation.case_ticket_id, state, draft, revision, binding}
        )
        |> Repo.all()
        |> Enum.map(fn {case_id, state, draft, revision, binding} ->
          {case_id, ticket_ref(state, draft, revision, binding)}
        end)
        |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))

      parents =
        from(relation in TicketWorker,
          join: state in TicketState,
          on: state.article_id == relation.parent_ticket_id,
          join: binding in ArticleBinding,
          on: binding.id == state.article_binding_id,
          left_join: draft in ArticleDraft,
          on: draft.article_id == state.article_id,
          left_join: public in ArticlePublic,
          on: public.article_id == state.article_id,
          left_join: revision in ArticleRevision,
          on: revision.id == public.revision_id,
          where: relation.worker_ticket_id in ^ticket_ids,
          select: {relation.worker_ticket_id, state, draft, revision, binding}
        )
        |> Repo.all()
        |> Map.new(fn {worker_id, state, draft, revision, binding} ->
          {worker_id, ticket_ref(state, draft, revision, binding)}
        end)

      Map.new(ticket_ids, fn id ->
        {id,
         empty
         |> Map.fetch!(id)
         |> Map.merge(%{
           assignees: Map.get(assignees, id, []),
           tags: Map.get(tags, id, []),
           facets: Map.get(facets, id, []),
           workers: Map.get(workers, id, []),
           members: Map.get(members, id, []),
           cases: Map.get(cases, id, []),
           shared_workers: Map.get(shared_workers, id, []),
           parent: Map.get(parents, id),
           updates: Map.get(updates, id, [])
         })}
      end)
    end
  end

  defp empty_relations do
    %{
      workers: [],
      assignees: [],
      tags: [],
      facets: [],
      members: [],
      cases: [],
      shared_workers: [],
      parent: nil,
      updates: []
    }
  end

  defp ticket_ref(state, draft, revision, binding) do
    current_content = draft || revision

    %{
      id: state.article_id,
      type: state.type,
      status: state.status,
      priority: state.priority,
      workflow_version: state.workflow_version,
      rank: state.rank,
      inner_id: binding.inner_id,
      title: current_content && current_content.title,
      digest: current_content && current_content.digest,
      planned_start_at: state.planned_start_at,
      planned_end_at: state.planned_end_at
    }
  end

  defp entry(
         state,
         article,
         binding,
         community,
         lifecycle,
         draft,
         revision,
         body,
         draft_body,
         public_body
       ) do
    draft_content = content_projection(draft, draft_body)
    published_content = content_projection(revision, public_body)
    current_content = if draft, do: draft_content, else: published_content

    %{
      id: article.id,
      article: article,
      binding: binding,
      community: community,
      revision: revision,
      body: body,
      title: current_content && current_content.title,
      digest: current_content && current_content.digest,
      publication_state: lifecycle && lifecycle.state,
      lifecycle_version: lifecycle && lifecycle.version,
      workflow_version: state.workflow_version,
      draft_version: draft && draft.version,
      draft_content: draft_content,
      published_content: published_content,
      has_unpublished_changes:
        if state.type == :user do
          if(draft && revision, do: draft.content_hash != revision.content_hash, else: !!draft)
        else
          nil
        end,
      type: state.type,
      status: state.status,
      priority: state.priority,
      planned_start_at: state.planned_start_at,
      planned_end_at: state.planned_end_at,
      started_at: state.started_at,
      completed_at: state.completed_at,
      rank: state.rank,
      inner_id: binding.inner_id,
      public: lifecycle && lifecycle.state == :published,
      public_query: false,
      created_at: article.inserted_at,
      updated_at: state.updated_at
    }
  end

  defp content_projection(nil, _body), do: nil

  defp content_projection(content, body) do
    %{
      body: body,
      digest: content.digest || "",
      title: content.title
    }
  end

  defp post_refs_by_ticket(ticket_ids, community_id, public?) do
    public_mode? = public? == true

    public_post_ids =
      case CMS.Tickets.PublicPosts.ids_query(community_id) do
        {:ok, query} ->
          linked_ids =
            from(link in Source, where: link.ticket_id in ^ticket_ids, select: link.post_id)

          query |> where([post], post.id in subquery(linked_ids)) |> Repo.all() |> MapSet.new()

        {:error, _reason} ->
          MapSet.new()
      end

    review_block_types =
      if public_mode? do
        %{}
      else
        from(link in Source,
          join: restriction in ArticleReviewBlock,
          on: restriction.article_id == link.post_id,
          where:
            link.ticket_id in ^ticket_ids and is_nil(restriction.resolved_at) and
              (is_nil(restriction.community_id) or restriction.community_id == ^community_id),
          select: {link.ticket_id, link.post_id, restriction.type}
        )
        |> Repo.all()
        |> Enum.group_by(fn {ticket_id, post_id, _type} -> {ticket_id, post_id} end)
        |> Map.new(fn {key, rows} ->
          {key,
           rows
           |> Enum.map(fn {_ticket_id, _post_id, type} -> Atom.to_string(type) end)
           |> Enum.uniq()}
        end)
      end

    refs =
      from(link in Source,
        join: post in Article,
        on: post.id == link.post_id,
        left_join: public in ArticlePublic,
        on: public.article_id == post.id,
        join: binding in ArticleBinding,
        on: binding.article_id == post.id and binding.community_id == ^community_id,
        where: link.ticket_id in ^ticket_ids and post.thread == :post,
        select: {link.ticket_id, link.id, link.type, post.id, binding.inner_id, public.title}
      )
      |> Repo.all()

    refs
    |> Enum.reject(fn {_ticket_id, _source_id, _type, post_id, inner_id, title} ->
      if public_mode? do
        not MapSet.member?(public_post_ids, post_id) or is_nil(inner_id) or is_nil(title)
      else
        false
      end
    end)
    |> Enum.map(fn {ticket_id, source_id, type, post_id, inner_id, title} ->
      {ticket_id,
       %{
         id: source_id,
         type: type,
         inner_id: inner_id,
         title: title,
         is_public: MapSet.member?(public_post_ids, post_id),
         review_block_types: Map.get(review_block_types, {ticket_id, post_id}, [])
       }}
    end)
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  defp post_exists_in_community?(post_id, community_id) do
    Repo.exists?(
      from(post in Article,
        join: binding in ArticleBinding,
        on: binding.article_id == post.id and binding.community_id == ^community_id,
        where: post.id == ^post_id and post.thread == :post
      )
    )
  end

  defp apply_internal_search(query, query_text) do
    prefix = query_text <> "%"

    case Integer.parse(query_text) do
      {inner_id, ""} when inner_id > 0 ->
        query
        |> where(
          [ticket_binding: binding, ticket_draft: draft, ticket_revision: revision],
          binding.inner_id == ^inner_id or
            like(fragment("lower(?)", draft.title), ^prefix) or
            (is_nil(draft.article_id) and like(fragment("lower(?)", revision.title), ^prefix))
        )
        |> order_by([ticket_state: state],
          asc:
            fragment("CASE WHEN ? = ? THEN 0 ELSE 1 END", as(:ticket_binding).inner_id, ^inner_id),
          asc: as(:ticket_draft).title,
          asc: as(:ticket_revision).title,
          asc: state.article_id
        )

      _ ->
        query
        |> where(
          [ticket_draft: draft, ticket_revision: revision],
          like(fragment("lower(?)", draft.title), ^prefix) or
            (is_nil(draft.article_id) and like(fragment("lower(?)", revision.title), ^prefix))
        )
        |> order_by([ticket_state: state],
          asc: as(:ticket_draft).title,
          asc: as(:ticket_revision).title,
          asc: state.article_id
        )
    end
  end

  defp join_internal_content(query) do
    query
    |> join(:left, [ticket_state: state], draft in ArticleDraft,
      on: draft.article_id == state.article_id,
      as: :ticket_draft
    )
    |> join(:left, [ticket_state: state], public in ArticlePublic,
      on: public.article_id == state.article_id,
      as: :ticket_public
    )
    |> join(:left, [ticket_public: public], revision in ArticleRevision,
      on: revision.id == public.revision_id,
      as: :ticket_revision
    )
  end

  defp maybe_filter_type(query, type) when type in [:user, :worker, :case] do
    where(query, [ticket_state: state], state.type == ^type)
  end

  defp maybe_filter_type(query, _type), do: query

  defp apply_public_filter(query, filter) do
    case Map.get(filter, :status) do
      status when status in [:todo, :wip, :done] ->
        where(query, [ticket_state: state], state.status == ^status)

      _ ->
        query
    end
  end

  defp apply_internal_filter(query, community_id, filter) do
    query
    |> where([ticket_state: state], state.type == ^(Map.get(filter, :type) || :user))
    |> maybe_filter_status(Map.get(filter, :status))
    |> maybe_filter_priority(Map.get(filter, :priority))
    |> maybe_filter_assignee(Map.get(filter, :assignee_id))
    |> maybe_filter_tags(filter_values(filter, :tag_ids), community_id)
    |> maybe_filter_facet("version", filter_values(filter, :versions))
    |> maybe_filter_facet("os", filter_values(filter, :operating_systems))
    |> maybe_filter_facet("module", filter_values(filter, :modules))
    |> maybe_filter_dates(filter)
  end

  defp maybe_filter_status(query, status)
       when status in [:todo, :wip, :done, :open, :resolved] do
    where(query, [ticket_state: state], state.status == ^status)
  end

  defp maybe_filter_status(query, _status), do: query

  defp maybe_filter_priority(query, priority) when priority in 0..3 do
    where(query, [ticket_state: state], state.priority == ^priority)
  end

  defp maybe_filter_priority(query, _priority), do: query

  defp maybe_filter_assignee(query, assignee_id) when is_integer(assignee_id) do
    assignee_query =
      from(assignee in TicketAssignee,
        where:
          assignee.ticket_id == parent_as(:ticket_state).article_id and
            assignee.user_id == ^assignee_id,
        select: 1
      )

    where(query, [ticket_state: _state], exists(subquery(assignee_query)))
  end

  defp maybe_filter_assignee(query, _assignee_id), do: query

  defp maybe_filter_tags(query, [_ | _] = tag_ids, community_id) do
    tag_query =
      from(ticket_tag in TicketTag,
        join: tag in CommunityTag,
        on: tag.id == ticket_tag.community_tag_id,
        where:
          ticket_tag.ticket_id == parent_as(:ticket_state).article_id and
            ticket_tag.community_tag_id in ^tag_ids and tag.community_id == ^community_id and
            tag.thread == :post,
        select: 1
      )

    where(query, [ticket_state: _state], exists(subquery(tag_query)))
  end

  defp maybe_filter_tags(query, _tag_ids, _community_id), do: query

  defp maybe_filter_facet(query, _key, []), do: query

  defp maybe_filter_facet(query, key, values) do
    facet_query =
      from(facet in TicketFacet,
        where:
          facet.ticket_id == parent_as(:ticket_state).article_id and
            facet.key == ^key and facet.value in ^values,
        select: 1
      )

    where(query, [ticket_state: _state], exists(subquery(facet_query)))
  end

  defp maybe_filter_dates(query, filter) do
    query =
      if Map.has_key?(filter, :created_after) or Map.has_key?(filter, :created_before) do
        query
        |> join(:inner, [ticket_state: state], article in Article,
          on: article.id == state.article_id,
          as: :ticket_article
        )
        |> maybe_created_after(Map.get(filter, :created_after))
        |> maybe_created_before(Map.get(filter, :created_before))
      else
        query
      end

    query
    |> maybe_updated_after(Map.get(filter, :updated_after))
    |> maybe_updated_before(Map.get(filter, :updated_before))
    |> maybe_planned_after(Map.get(filter, :planned_after))
    |> maybe_planned_before(Map.get(filter, :planned_before))
  end

  defp maybe_created_after(query, %DateTime{} = value) do
    where(query, [ticket_article: article], article.inserted_at >= ^value)
  end

  defp maybe_created_after(query, _value), do: query

  defp maybe_created_before(query, %DateTime{} = value) do
    where(query, [ticket_article: article], article.inserted_at <= ^value)
  end

  defp maybe_created_before(query, _value), do: query

  defp maybe_updated_after(query, %DateTime{} = value) do
    where(query, [ticket_state: state], state.updated_at >= ^value)
  end

  defp maybe_updated_after(query, _value), do: query

  defp maybe_updated_before(query, %DateTime{} = value) do
    where(query, [ticket_state: state], state.updated_at <= ^value)
  end

  defp maybe_updated_before(query, _value), do: query

  defp maybe_planned_after(query, %DateTime{} = value) do
    where(query, [ticket_state: state], state.planned_end_at >= ^value)
  end

  defp maybe_planned_after(query, _value), do: query

  defp maybe_planned_before(query, %DateTime{} = value) do
    where(query, [ticket_state: state], state.planned_start_at <= ^value)
  end

  defp maybe_planned_before(query, _value), do: query

  defp filter_values(filter, key) do
    filter
    |> Map.get(key, [])
    |> List.wrap()
    |> Enum.filter(&(is_binary(&1) and String.trim(&1) != ""))
    |> Enum.map(&(String.trim(&1) |> String.downcase()))
    |> Enum.uniq()
  end

  defp offset_position(nil), do: {:ok, 1, @default_size}

  defp offset_position(input) do
    with {:ok, %Pagi.Params.Offset{page: page, size: size}} <-
           Pagi.from_input(input, @default_size),
         true <- page > 0 and size > 0 and size <= @max_size do
      {:ok, page, size}
    else
      _ -> {:error, ErrorCat.invalid_ticket_content()}
    end
  end

  defp page_info(page, size, total_count) do
    total_pages = if total_count == 0, do: 0, else: div(total_count + size - 1, size)

    %{
      api: :offset,
      page: page,
      size: size,
      total_count: total_count,
      total_pages: total_pages,
      has_previous_page: page > 1,
      has_next_page: page < total_pages
    }
  end
end
