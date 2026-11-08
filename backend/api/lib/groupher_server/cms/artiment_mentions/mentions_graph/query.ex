defmodule GroupherServer.CMS.ArtimentMentions.MentionsGraph.Query do
  @moduledoc """
  Reads a bounded page of the focus resource's direct Mention edges.

      Community + locators -> revision fence -> current-edge windows -> node statuses
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.MentionsGraph
  alias MentionsGraph.NodeStatus
  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Model.{ArticleBinding, Comment, Community}

  @max_first 20

  @doc "Returns one bounded graph page and rejects pages changed during the read."
  def page(community_slug, focus, after_cursor, first)
      when is_binary(community_slug) and is_map(focus) and
             (is_nil(after_cursor) or is_binary(after_cursor)) and is_integer(first) and
             first in 1..@max_first do
    transaction(fn ->
      with {:ok, revision} <- Revision.current(),
           {:ok, community} <- community(community_slug),
           {:ok, [focus_node]} <- NodeStatus.resolve_locators(community, [focus]),
           {:ok, :pass} <- validate_focus(focus_node),
           {:ok, edge_page} <- focus_page(community, revision, focus_node, after_cursor, first),
           {:ok, endpoint_nodes} <- load_edge_node_statuses(community, edge_page),
           {:ok, enriched_page} <-
             attach_node_statuses(
               community,
               revision,
               first,
               edge_page,
               focus_node,
               endpoint_nodes
             ),
           {:ok, graph} <- build_graph(community, focus_node, enriched_page),
           {:ok, :pass} <- unchanged_revision(revision) do
        {:ok,
         graph
         |> Map.put(:revision, Integer.to_string(revision))}
      end
    end)
  end

  def page(_, _, _, _), do: {:error, CMS.ErrorCat.mentions_graph_invalid_request()}

  @doc "Returns Comment locators with stored outgoing edges, including soft-deleted Comments."
  def article_comments(community_slug, focus, after_cursor, first)
      when is_binary(community_slug) and is_map(focus) and is_integer(first) and
             first in 1..@max_first do
    transaction(fn ->
      with {:ok, revision} <- Revision.current(),
           {:ok, community} <- community(community_slug),
           {:ok, after_id} <- parse_comment_cursor(after_cursor),
           {:ok, [focus_node]} <- NodeStatus.resolve_locators(community, [focus]),
           {:ok, :pass} <- validate_article_comment_focus(focus_node),
           article_id <- elem(focus_node.identity, 1),
           rows <-
             comment_seed_rows(community, article_id, after_id, first + 1),
           selected <- Enum.take(rows, first),
           {:ok, :pass} <- unchanged_revision(revision) do
        {:ok,
         %{
           comments:
             Enum.map(selected, fn row ->
               %{
                 type: :comment,
                 article_inner_id: row.article_inner_id,
                 comment_inner_id: row.comment_inner_id
               }
             end),
           has_next_page: length(rows) > first,
           end_cursor:
             if(length(rows) > first and selected != [],
               do: to_string(List.last(selected).comment_inner_id)
             ),
           revision: Integer.to_string(revision)
         }}
      else
        {:ok, _} -> {:error, CMS.ErrorCat.mentions_graph_not_found()}
        {:error, _reason} = error -> error
      end
    end)
  end

  def article_comments(_, _, _, _), do: {:error, CMS.ErrorCat.mentions_graph_invalid_request()}

  def revision(community_slug, focus) do
    transaction(fn ->
      with {:ok, community} <- community(community_slug),
           {:ok, [focus_node]} <- NodeStatus.resolve_locators(community, [focus]),
           {:ok, :pass} <- validate_focus(focus_node),
           {:ok, revision} <- Revision.current() do
        {:ok, Integer.to_string(revision)}
      else
        {:error, _reason} = error -> error
        _ -> {:error, CMS.ErrorCat.mentions_graph_not_found()}
      end
    end)
  end

  defp maybe_after_edge(query, nil), do: query
  defp maybe_after_edge(query, edge_key), do: where(query, [edge], edge.edge_key > ^edge_key)

  defp focus_page(community, revision, node, after_cursor, first) do
    with {:ok, after_key} <-
           decode_cursor(after_cursor, community.id, revision, node.identity) do
      base =
        from(edge in Edge,
          where: not is_nil(edge.target_endpoint_id)
        )
        |> maybe_after_edge(after_key)

      outgoing =
        from(edge in base,
          where: edge.source_endpoint_id == ^node.endpoint_id,
          order_by: [asc: edge.edge_key],
          limit: ^(first + 1)
        )

      incoming =
        from(edge in base,
          where: edge.target_endpoint_id == ^node.endpoint_id,
          order_by: [asc: edge.edge_key],
          limit: ^(first + 1)
        )

      # Bound both directions before merging; UNION removes a self-edge's duplicate.
      merged = from(edge in subquery(outgoing), union: ^from(edge in subquery(incoming)))
      query = from(edge in subquery(merged), order_by: [asc: edge.edge_key], limit: ^(first + 1))

      rows = Repo.all(query)

      {:ok,
       %{
         rows: [],
         raw_rows: rows,
         has_more?: false,
         cursor: nil
       }}
    end
  end

  defp load_edge_node_statuses(community, edge_page) do
    endpoint_ids =
      edge_page.raw_rows
      |> Enum.flat_map(&[&1.source_endpoint_id, &1.target_endpoint_id])
      |> Enum.uniq()

    endpoints =
      case endpoint_ids do
        [] ->
          []

        _ ->
          Repo.all(from(endpoint in Endpoint, where: endpoint.id in ^endpoint_ids))
      end

    with {:ok, nodes} <- NodeStatus.load_endpoints(community, endpoints) do
      {:ok, nodes}
    end
  end

  defp attach_node_statuses(
         community,
         revision,
         first,
         edge_page,
         focus_node,
         nodes_by_identity
       ) do
    node_by_endpoint =
      nodes_by_identity
      |> Map.values()
      |> Enum.reject(&is_nil(&1.endpoint_id))
      |> Map.new(&{&1.endpoint_id, &1})

    candidates =
      Enum.flat_map(edge_page.raw_rows, fn row ->
        source =
          if row.source_endpoint_id == focus_node.endpoint_id,
            do: focus_node,
            else: Map.get(node_by_endpoint, row.source_endpoint_id)

        target =
          if row.target_endpoint_id == focus_node.endpoint_id,
            do: focus_node,
            else: Map.get(node_by_endpoint, row.target_endpoint_id)

        if is_nil(source) or is_nil(target) do
          []
        else
          [Map.merge(row, %{source_node: source, target_node: target})]
        end
      end)

    has_more? = length(candidates) > first
    selected = Enum.take(candidates, first)

    cursor =
      if has_more? and selected != [] do
        encode_cursor(community.id, revision, focus_node.identity, List.last(selected).edge_key)
      end

    {:ok, %{edge_page | rows: selected, has_more?: has_more?, cursor: cursor}}
  end

  defp validate_focus(%{identity: identity}) when not is_nil(identity), do: {:ok, :pass}
  defp validate_focus(_), do: {:error, CMS.ErrorCat.mentions_graph_not_found()}

  defp validate_article_comment_focus(%{endpoint_id: id, identity: {type, _, nil, _}})
       when not is_nil(id) and type in [:post, :blog, :changelog, :doc] do
    {:ok, :pass}
  end

  defp validate_article_comment_focus(_), do: {:error, CMS.ErrorCat.mentions_graph_not_found()}

  defp parse_comment_cursor(nil), do: {:ok, 0}

  defp parse_comment_cursor(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 and id <= 9_223_372_036_854_775_807 -> {:ok, id}
      _ -> {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
    end
  end

  defp parse_comment_cursor(_), do: {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}

  defp comment_seed_rows(community, article_id, after_id, limit) do
    query =
      from(comment in Comment,
        where: comment.article_id == ^article_id and comment.inner_id > ^after_id,
        join: binding in ArticleBinding,
        on: binding.article_id == comment.article_id and binding.community_id == ^community.id,
        as: :mention_comment_binding
      )

    query
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
    |> join(:inner, [comment, ...], edge in Edge,
      on: edge.source_endpoint_id == as(:mention_endpoint).id,
      as: :mention_current_edge
    )
    |> select([comment, ...], %{
      article_inner_id: as(:mention_comment_binding).inner_id,
      comment_inner_id: comment.inner_id
    })
    |> distinct(true)
    |> order_by([comment, ...], asc: comment.inner_id)
    |> limit(^limit)
    |> then(&Repo.all(&1))
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

  defp encode_cursor(community_id, revision, identity, edge_key) do
    key = Application.fetch_env!(:groupher_server, :mentions_graph_key)

    payload =
      :erlang.term_to_binary({1, community_id, revision, identity, edge_key})

    signature = :crypto.mac(:hmac, :sha256, key, payload)
    Base.url_encode64(payload <> signature, padding: false)
  end

  defp decode_cursor(nil, _community_id, _revision, _identity), do: {:ok, nil}

  defp decode_cursor(cursor, community_id, revision, identity)
       when is_binary(cursor) and byte_size(cursor) <= 4096 do
    key = Application.fetch_env!(:groupher_server, :mentions_graph_key)

    with {:ok, decoded} <- Base.url_decode64(cursor, padding: false),
         true <- byte_size(decoded) > 32,
         payload_size <- byte_size(decoded) - 32,
         <<payload::binary-size(^payload_size), signature::binary-size(32)>> <- decoded,
         expected <- :crypto.mac(:hmac, :sha256, key, payload),
         true <- Plug.Crypto.secure_compare(signature, expected),
         {version, ^community_id, ^revision, ^identity, edge_key} <-
           :erlang.binary_to_term(payload, [:safe]),
         true <- version == 1,
         true <- is_binary(edge_key) do
      {:ok, edge_key}
    else
      _ -> {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
    end
  rescue
    _ -> {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}
  end

  defp decode_cursor(_, _, _, _), do: {:error, CMS.ErrorCat.mentions_graph_invalid_cursor()}

  defp build_graph(community, focus, page) do
    {nodes, edges} =
      Enum.reduce(page.rows, {%{graph_node_key(focus) => focus}, %{}}, fn row, {nodes, edges} ->
        source = row.source_node
        target = row.target_node

        edge = %{
          id: "edge:#{community.id}:#{row.id}",
          from: source.id,
          to: target.id,
          occurrences_count: row.occurrences_count
        }

        {
          nodes
          |> Map.put(graph_node_key(source), source)
          |> Map.put(graph_node_key(target), target),
          Map.put(edges, edge.id, edge)
        }
      end)

    {:ok,
     %{
       nodes: nodes |> Map.values() |> Enum.uniq_by(& &1.id),
       edges: Map.values(edges),
       has_next_page: page.has_more?,
       end_cursor: page.cursor
     }}
  end

  defp graph_node_key(%{endpoint_id: endpoint_id}) when not is_nil(endpoint_id), do: endpoint_id
  defp graph_node_key(node), do: node.identity
end
