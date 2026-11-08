defmodule GroupherServer.CMS.ArtimentMentions.Query do
  @moduledoc """
  Reads selected source content and public Mention lists.

      endpoint -> current published revision identity; public source -> outgoing/incoming lists
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.MentionsGraph.NodeStatus
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Outbox.Event
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Comment, as: CommentScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Gate.Context.Scope.Ticket, as: TicketScope
  alias CMS.Model.{Community, TicketState}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Pagi.Params
  alias Helper.ORM.Pagi.Page
  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision

  @max_first 20

  alias CMS.Model.{
    Article,
    ArticlePublic,
    Comment,
    CommentBody,
    DocPublic,
    DocBranch,
    DocBranchVersion
  }

  @doc "Reads existing and undelivered User recipients for one Mention source."
  def previous_user_state(source_id) do
    ids =
      from(edge in Edge,
        where: edge.source_endpoint_id == ^source_id and edge.target_type == :user,
        select: edge.target_user_id,
        distinct: true
      )
      |> Repo.all()

    pending = if ids == [], do: [], else: pending_user_ids(source_id)
    %{ids: ids, pending: pending}
  end

  defp pending_user_ids(source_id) do
    events =
      from(event in Event,
        where:
          event.event == "mention.notify" and event.resource_type == "mention_source" and
            event.resource_id == ^source_id,
        select: {event.data, event.status}
      )
      |> Repo.all()

    consumed =
      Enum.flat_map(events, fn {data, _status} -> Map.get(data, "consumed_user_ids", []) end)

    pending =
      Enum.flat_map(events, fn
        {_data, :done} -> []
        {data, _status} -> Map.get(data, "notify_user_ids", [])
      end)

    Enum.uniq(pending) -- Enum.uniq(consumed)
  end

  def selected_source(%{type: :comment, comment_id: id}) do
    with {:ok, %Comment{} = comment} <- CMS.FrontDesk.comment(id, mode: :internal),
         %CommentBody{} = body <- Repo.get_by(CommentBody, comment_id: id),
         {:ok, %Article{} = parent} <-
           CMS.FrontDesk.article(comment.article_id, mode: :internal),
         {:ok, selected} <- selected_source(%{type: parent.thread, article_id: parent.id}) do
      {:ok,
       %{
         content: comment,
         published_revision_identity: "#{id}:#{body.version}:#{body.body_hash}",
         title: selected.title,
         article_id: parent.id,
         thread: parent.thread,
         author_user_id: comment.author_id,
         branch_id: selected.branch_id
       }}
    else
      _ -> {:error, :mention_current_source_missing}
    end
  end

  def selected_source(%{type: :doc, article_id: id}) do
    query =
      from(public in DocPublic,
        join: branch in DocBranch,
        on: branch.id == public.branch_id and branch.type == :main,
        join: version in DocBranchVersion,
        on: version.id == public.branch_version_id,
        where: public.article_id == ^id,
        select: {public, version.revision_id}
      )

    case Repo.all(query) do
      [{public, revision_id}] ->
        with {:ok, %Article{thread: :doc} = article} <-
               CMS.FrontDesk.article(id, mode: :internal) do
          content = %{
            article_id: id,
            thread: :doc,
            branch_id: public.branch_id,
            revision_id: revision_id,
            title: public.title
          }

          {:ok,
           %{
             content: content,
             published_revision_identity:
               "#{public.branch_id}:#{public.branch_version_id}:#{public.publication_version}",
             title: public.title,
             article_id: id,
             thread: :doc,
             author_id: article.author_id,
             branch_id: public.branch_id
           }}
        else
          _ -> {:error, :mention_current_source_missing}
        end

      [] ->
        {:error, :mention_current_source_missing}

      _ ->
        {:error, :mention_current_source_ambiguous}
    end
  end

  def selected_source(%{type: type, article_id: id})
      when type in [:post, :blog, :changelog, :ticket] do
    with {:ok, %Article{thread: ^type} = article} <-
           CMS.FrontDesk.article(id, mode: :internal),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, id) do
      {:ok,
       %{
         content: article,
         published_revision_identity: "#{public.revision_id}:#{public.publication_version}",
         title: public.title,
         article_id: id,
         thread: type,
         author_id: article.author_id,
         branch_id: nil
       }}
    else
      _ -> {:error, :mention_current_source_missing}
    end
  end

  def selected_source(_), do: {:error, :invalid_mention_source}
  @doc "Lists current relationships written by one source."
  def mentions(community, source, pagi), do: list(community, :outgoing, source, pagi)

  @doc "Lists sources with stored relationships to one target."
  def mentioned_by(community, target, pagi), do: list(community, :incoming, target, pagi)

  defp list(community_slug, direction, root_input, pagi)
       when is_binary(community_slug) and direction in [:outgoing, :incoming] and
              is_map(root_input) do
    transaction(fn ->
      with {:ok, revision} <- Revision.current(),
           {:ok, community} <- community(community_slug),
           {:ok, page_request} <- normalize_list_page(pagi),
           {:ok, root} <- resolve_list_root(community, direction, root_input),
           {:ok, page_rows, page_info} <-
             list_edge_page(community, direction, root, revision, page_request),
           {:ok, entries} <-
             project_list_entries(community, direction, root, page_rows),
           {:ok, :pass} <- unchanged_revision(revision) do
        {:ok,
         %{
           entries: entries,
           page_info: page_info,
           revision: Integer.to_string(revision)
         }}
      end
    end)
  end

  defp list(_, _, _, _), do: {:error, CMS.ErrorCat.mentions_graph_invalid_request()}

  defp validate_focus(%{identity: identity}) when not is_nil(identity), do: {:ok, :pass}
  defp validate_focus(_), do: {:error, CMS.ErrorCat.mentions_graph_not_found()}

  defp normalize_list_page(nil), do: {:ok, %Params.Cursor{first: @max_first, after: nil}}

  defp normalize_list_page(%Params.Cursor{first: first} = page)
       when is_integer(first) and first in 1..@max_first do
    {:ok, page}
  end

  defp normalize_list_page(%Params.Offset{page: page, size: size} = request)
       when is_integer(page) and page in 1..10_000 and is_integer(size) and size in 1..@max_first do
    {:ok, request}
  end

  defp normalize_list_page(_), do: {:error, CMS.ErrorCat.mentions_graph_invalid_request()}

  defp resolve_list_root(_community, direction, %{type: :user, user_login: login})
       when direction == :incoming and is_binary(login) do
    case Repo.get_by(User, login: login) do
      %User{} = user ->
        {:ok, %{identity: {:user, user.id}, user: user, node: nil, endpoint_id: nil}}

      _ ->
        {:error, CMS.ErrorCat.mentions_graph_not_found()}
    end
  end

  defp resolve_list_root(community, direction, %{type: type} = input)
       when type in [:post, :blog, :changelog, :doc, :ticket, :comment] do
    locator = Map.get(input, :locator)

    with true <- is_map(locator) and Map.get(locator, :type) == type,
         {:ok, [node]} <- NodeStatus.resolve_locators(community, [locator]),
         {:ok, :pass} <- validate_focus(node) do
      case direction do
        :outgoing ->
          {:ok, %{identity: node.identity, node: node, endpoint_id: node.endpoint_id, user: nil}}

        :incoming ->
          {:ok, %{identity: node.identity, node: node, endpoint_id: node.endpoint_id, user: nil}}
      end
    else
      false -> {:error, CMS.ErrorCat.mentions_graph_invalid_locator()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.mentions_graph_not_found()}
    end
  end

  defp resolve_list_root(_community, _direction, _input) do
    {:error, CMS.ErrorCat.mentions_graph_invalid_locator()}
  end

  defp list_edge_page(community, direction, root, revision, page_request) do
    query =
      from(edge in Edge, order_by: [asc: edge.edge_key])
      |> constrain_list_root(direction, root)

    case page_request do
      %Params.Offset{page: page, size: size} ->
        total =
          Repo.aggregate(query, :count, :id)

        offset = (page - 1) * size

        rows =
          query
          |> limit(^size)
          |> offset(^offset)
          |> then(&Repo.all(&1))

        page_info = %Page.Offset{
          entries: rows,
          page: page,
          size: size,
          total_count: total,
          total_pages: if(total == 0, do: 0, else: ceil(total / size)),
          has_previous_page: page > 1,
          has_next_page: page * size < total
        }

        {:ok, rows, page_info}

      %Params.Cursor{first: first, after: cursor} ->
        with {:ok, after_key} <-
               decode_list_cursor(cursor, community.id, revision, direction, root.identity) do
          rows =
            query
            |> maybe_after_edge(after_key)
            |> limit(^(first + 1))
            |> then(&Repo.all(&1))

          has_next_page = length(rows) > first
          selected = Enum.take(rows, first)
          last_key = if has_next_page, do: List.last(selected).edge_key

          with {:ok, end_cursor} <-
                 encode_list_cursor(community.id, revision, direction, root.identity, last_key) do
            {:ok, selected,
             %Page.Cursor{
               entries: selected,
               start_cursor: nil,
               end_cursor: end_cursor,
               has_previous_page: not is_nil(cursor),
               has_next_page: has_next_page
             }}
          end
        end
    end
  end

  defp constrain_list_root(query, :outgoing, %{endpoint_id: endpoint_id}) do
    where(query, [edge], edge.source_endpoint_id == ^endpoint_id)
  end

  defp constrain_list_root(query, :incoming, %{endpoint_id: endpoint_id})
       when is_binary(endpoint_id) do
    where(query, [edge], edge.target_endpoint_id == ^endpoint_id)
  end

  defp constrain_list_root(query, :incoming, %{identity: {:user, user_id}}) do
    where(query, [edge], edge.target_type == :user and edge.target_user_id == ^user_id)
  end

  defp constrain_list_root(query, _direction, _root), do: where(query, [edge], false)

  defp maybe_after_edge(query, nil), do: query
  defp maybe_after_edge(query, edge_key), do: where(query, [edge], edge.edge_key > ^edge_key)

  defp project_list_entries(community, direction, root, rows) do
    endpoint_ids =
      rows
      |> Enum.flat_map(&[&1.source_endpoint_id, &1.target_endpoint_id])
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    endpoints =
      case endpoint_ids do
        [] ->
          []

        ids ->
          Repo.all(from(endpoint in Endpoint, where: endpoint.id in ^ids))
      end

    with {:ok, nodes_by_identity} <- NodeStatus.load_endpoints(community, endpoints),
         users <- load_list_users(rows, root) do
      nodes_by_endpoint =
        nodes_by_identity
        |> Map.values()
        |> Map.new(&{&1.endpoint_id, &1})

      Enum.reduce_while(rows, {:ok, []}, fn edge, {:ok, acc} ->
        source =
          if direction == :outgoing,
            do: root.node,
            else: Map.get(nodes_by_endpoint, edge.source_endpoint_id)

        target =
          case edge.target_type do
            :url -> %{__typename: :mention_url_target, type: :url, url: edge.normalized_url}
            :user -> user_target(Map.get(users, edge.target_user_id))
            _ when direction == :outgoing -> Map.get(nodes_by_endpoint, edge.target_endpoint_id)
            _ -> root.node
          end

        if is_nil(source) or is_nil(target) do
          {:halt, {:error, CMS.ErrorCat.mentions_graph_invalid_request()}}
        else
          entry = %{
            id: "edge:#{community.id}:#{edge.id}",
            source: source,
            target_type: edge.target_type,
            target: target,
            mention_case: edge.mention_case,
            occurrences_count: edge.occurrences_count,
            mentioned_at: edge.mentioned_at
          }

          {:cont, {:ok, [entry | acc]}}
        end
      end)
      |> case do
        {:ok, entries} -> {:ok, Enum.reverse(entries)}
        {:error, _reason} = error -> error
      end
    end
  end

  defp load_list_users(rows, root) do
    ids =
      rows
      |> Enum.filter(&(&1.target_type == :user))
      |> Enum.map(& &1.target_user_id)
      |> Kernel.++(if(root.identity |> elem(0) == :user, do: [elem(root.identity, 1)], else: []))
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    case ids do
      [] ->
        %{}

      _ ->
        Repo.all(from(user in User, where: user.id in ^ids, select: user))
        |> Map.new(&{&1.id, &1})
    end
  end

  defp user_target(%User{} = user) do
    login = user.login

    %{
      __typename: :mention_user_target,
      type: :user,
      status: :readable,
      login: login,
      display_name: user.nickname || login,
      url: "/u/#{URI.encode(login)}"
    }
  end

  defp user_target(_) do
    %{
      __typename: :mention_user_target,
      type: :user,
      status: :unavailable,
      login: nil,
      display_name: nil,
      url: nil
    }
  end

  defp encode_list_cursor(_community_id, _revision, _direction, _identity, nil), do: {:ok, nil}

  defp encode_list_cursor(community_id, revision, direction, identity, edge_key) do
    key = Application.fetch_env!(:groupher_server, :mentions_graph_key)

    payload =
      :erlang.term_to_binary(
        {1, :mentions_list, community_id, revision, direction, identity, edge_key}
      )

    signature = :crypto.mac(:hmac, :sha256, key, payload)
    {:ok, Base.url_encode64(payload <> signature, padding: false)}
  end

  defp decode_list_cursor(nil, _community_id, _revision, _direction, _identity), do: {:ok, nil}

  defp decode_list_cursor(cursor, community_id, revision, direction, identity)
       when is_binary(cursor) and byte_size(cursor) <= 4096 do
    key = Application.fetch_env!(:groupher_server, :mentions_graph_key)

    with {:ok, decoded} <- Base.url_decode64(cursor, padding: false),
         true <- byte_size(decoded) > 32,
         payload_size <- byte_size(decoded) - 32,
         <<payload::binary-size(^payload_size), signature::binary-size(32)>> <- decoded,
         expected <- :crypto.mac(:hmac, :sha256, key, payload),
         true <- Plug.Crypto.secure_compare(signature, expected),
         {version, :mentions_list, ^community_id, ^revision, ^direction, ^identity, edge_key} <-
           :erlang.binary_to_term(payload, [:safe]),
         true <- version == 1 and is_binary(edge_key) do
      {:ok, edge_key}
    else
      _ -> {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
    end
  rescue
    _ -> {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
  end

  defp decode_list_cursor(_, _, _, _, _) do
    {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
  end

  def source_endpoint_ids(community) do
    ordinary =
      [:post, :blog, :changelog]
      |> Enum.map(fn type ->
        scope =
          CMS.Gate.scope(Article, nil, :read, ArticleScope.public(type)) |> scope_query()

        scope
        |> join(:inner, [article, ...], endpoint in Endpoint,
          on: endpoint.type == ^type and endpoint.article_id == article.id,
          as: :mention_endpoint
        )
        |> where([article, endpoint, ...], as(:gate_community).id == ^community.id)
        |> current_endpoint_selection(:article)
      end)

    doc =
      CMS.Gate.scope(Article, nil, :read, DocScope.public_main())
      |> scope_query()
      |> join(:inner, [article, ...], endpoint in Endpoint,
        on: endpoint.type == :doc and endpoint.article_id == article.id,
        as: :mention_endpoint
      )
      |> where([article, endpoint, ...], as(:gate_community).id == ^community.id)
      |> current_endpoint_selection(:doc)

    ticket =
      CMS.Gate.scope(TicketState, nil, :read, TicketScope.public(community))
      |> scope_query()
      |> join(:inner, [ticket_state: state], endpoint in Endpoint,
        on: endpoint.type == :ticket and endpoint.article_id == state.article_id,
        as: :mention_endpoint
      )
      |> current_endpoint_selection(:ticket)

    comments =
      CMS.Gate.scope(Comment, nil, :read, CommentScope.all_public())
      |> scope_query()
      |> where([comment, ...], as(:gate_community).id == ^community.id)
      |> join(:inner, [comment, ...], parent_endpoint in Endpoint,
        on:
          parent_endpoint.article_id == comment.article_id and
            parent_endpoint.type == comment.thread,
        as: :mention_parent_endpoint
      )
      |> join(:inner, [comment, ...], endpoint in Endpoint,
        on:
          endpoint.type == :comment and endpoint.comment_id == comment.id and
            endpoint.parent_endpoint_id == as(:mention_parent_endpoint).id,
        as: :mention_endpoint
      )
      |> join(:inner, [comment, ...], body in CommentBody,
        on: body.comment_id == comment.id,
        as: :mention_comment_body
      )
      |> current_endpoint_selection(:comment)

    [ordinary, doc, ticket, comments]
    |> List.flatten()
    |> Enum.reject(&is_nil/1)
    |> union_queries()
  end

  @doc "Checks notification admission for this source in the event's Community."
  def source_visible?(%Endpoint{} = endpoint, community_id) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{} = community ->
        Repo.exists?(
          from(source in subquery(source_endpoint_ids(community)),
            where: source.id == ^endpoint.id
          )
        )

      nil ->
        false
    end
  end

  def source_visible?(_, _), do: false

  defp current_endpoint_selection(query, _source_type) do
    select(query, [...], %{id: as(:mention_endpoint).id})
  end

  defp union_queries([query]), do: query

  defp union_queries([query | rest]) do
    Enum.reduce(rest, query, fn next, acc -> union_all(acc, ^next) end)
  end

  defp unchanged_revision(revision) do
    case Revision.current() do
      {:ok, ^revision} -> {:ok, :pass}
      {:ok, _changed} -> {:error, CMS.ErrorCat.mentions_graph_invalid_request()}
      {:error, _reason} = error -> error
    end
  end

  defp community(slug) do
    case Repo.get_by(Community, slug: slug) do
      %Community{} = community -> {:ok, community}
      _ -> {:error, CMS.ErrorCat.mentions_graph_not_found()}
    end
  end

  defp transaction(fun) do
    if Repo.in_transaction?() do
      fun.()
    else
      case Repo.transaction(fun) do
        {:ok, result} -> result
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp scope_query({:ok, %Ecto.Query{} = query}), do: query
  defp scope_query(%Ecto.Query{} = query), do: query
end
