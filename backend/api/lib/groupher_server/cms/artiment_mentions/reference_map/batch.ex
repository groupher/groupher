defmodule GroupherServer.CMS.ArtimentMentions.ReferenceMap.Batch do
  @moduledoc """
  Projects a bounded frontier batch from batched anonymous public reads.

      public locators -> ReadModel -> directed adjacency -> signed cursor
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.{GraphRevision, Opaque}
  alias CMS.ArtimentMentions.Model.SyncState
  alias CMS.ArtimentMentions.ReferenceMap.ReadModel
  alias CMS.ArtimentMentions.ReferenceMap.PageFacts
  alias CMS.Model.{ArticleBinding, Comment, Community}
  alias CMS.Model.ArtimentMention
  alias CMS.Gate.Context.Scope.Comment, as: CommentScope

  def page(community_slug, focus, frontiers, first)
      when is_list(frontiers) and length(frontiers) in 1..10 and is_integer(first) and
             first in 1..20 do
    transaction(fn ->
      with {:ok, community} <- community(community_slug),
           {:ok, :pass} <- distinct_inputs(frontiers),
           {:ok, context, [focus_result | frontier_results]} <-
             ReadModel.load(community, [focus | Enum.map(frontiers, & &1.node)], false),
           {:ok, _focus_node} <- readable_focus(focus_result),
           {:ok, :pass} <- distinct(frontier_results),
           {:ok, decoded} <- decode_frontiers(community.id, frontiers, frontier_results),
           context <-
             scan_frontiers(context, [focus | Enum.map(frontiers, & &1.node)], decoded, first),
           {:ok, neighborhoods, nodes, edges} <-
             neighborhoods(context, frontiers, frontier_results, first) do
        {:ok,
         %{
           nodes: Map.values(nodes),
           edges: Map.values(edges),
           neighborhoods: neighborhoods,
           projection_pending:
             Enum.any?(Map.values(nodes), &(&1.sync_state == :pending)) or
               CMS.ArtimentMentions.ReferenceMap.community_pending?(community)
         }}
      end
    end)
  end

  def page(_, _, _, _), do: {:error, "invalid reference map request"}

  def article_comments(community_slug, focus, after_inner_id, first)
      when is_integer(first) and first in 1..20 do
    transaction(fn ->
      with {:ok, community} <- community(community_slug),
           {:ok, after_id} <- parse_comment_after(after_inner_id),
           {:ok, _context, [focus_result]} <- ReadModel.load(community, [focus], false),
           {:ok, %{key: {type, article_id, nil, branch_id}, article_inner_id: inner_id}} <-
             readable_focus(focus_result),
           true <- type in [:post, :blog, :changelog, :doc] do
        comments = public_article_comments(community, article_id, branch_id, after_id, first + 1)
        selected = Enum.take(comments, first)
        more = length(comments) > first

        {:ok,
         %{
           comments:
             Enum.map(selected, fn comment_inner_id ->
               %{type: :comment, article_inner_id: inner_id, comment_inner_id: comment_inner_id}
             end),
           has_next_page: more,
           end_cursor: if(more, do: to_string(List.last(selected)), else: nil)
         }}
      else
        false -> {:error, "invalid reference map request"}
        {:ok, _} -> {:error, "invalid reference map request"}
        error -> error
      end
    end)
  end

  def article_comments(_, _, _, _), do: {:error, "invalid reference map request"}

  def revision(community_slug, focus) do
    transaction(fn ->
      with {:ok, community} <- community(community_slug),
           {:ok, _context, [focus_result]} <- ReadModel.load(community, [focus], false),
           {:ok, _node} <- readable_focus(focus_result),
           {:ok, revision} <- GraphRevision.current(community.id) do
        {:ok, Opaque.id(:revision, community.id, revision)}
      end
    end)
  end

  def community_pending?(community) do
    article_candidates =
      Repo.all(
        from(s in SyncState,
          join: b in ArticleBinding,
          on: b.article_id == s.source_article_id and b.community_id == ^community.id,
          where:
            is_nil(s.synced_content_token) or
              s.desired_content_token != s.synced_content_token,
          select: {s.source_type, s.source_article_id, s.source_comment_id, s.source_branch_id}
        )
      )

    comment_candidates =
      Repo.all(
        from(s in SyncState,
          join: c in Comment,
          on: c.id == s.source_comment_id,
          join: b in ArticleBinding,
          on: b.article_id == c.article_id and b.community_id == ^community.id,
          where:
            is_nil(s.synced_content_token) or
              s.desired_content_token != s.synced_content_token,
          select: {s.source_type, s.source_article_id, s.source_comment_id, s.source_branch_id}
        )
      )

    ReadModel.public_pending_source?(community, article_candidates ++ comment_candidates)
  end

  defp transaction(fun) do
    if Repo.in_transaction?() or
         Application.get_env(:groupher_server, :reference_map_test_sandbox, false) do
      fun.()
    else
      case Repo.transaction(fn ->
             Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
             fun.()
           end) do
        {:ok, result} -> result
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp community(slug) do
    case CMS.FrontDesk.community(slug) do
      {:ok, %Community{} = community} -> {:ok, community}
      _ -> {:error, "not found"}
    end
  end

  defp readable_focus({:ok, node}), do: {:ok, node}
  defp readable_focus(_), do: {:error, "not found"}

  defp parse_comment_after(nil), do: {:ok, 0}

  defp parse_comment_after(id)
       when is_integer(id) and id > 0 and id <= 9_223_372_036_854_775_807,
       do: {:ok, id}

  defp parse_comment_after(value) when is_binary(value) and byte_size(value) <= 20 do
    case Integer.parse(value) do
      {id, ""} when id > 0 and id <= 9_223_372_036_854_775_807 -> {:ok, id}
      _ -> {:error, "invalid cursor"}
    end
  end

  defp parse_comment_after(_), do: {:error, "invalid cursor"}

  defp public_article_comments(community, article_id, branch_id, after_id, limit) do
    scope = CMS.Gate.scope(Comment, nil, :read, CommentScope.all_public())
    query = if match?({:ok, %Ecto.Query{}}, scope), do: elem(scope, 1), else: scope

    query
    |> where(
      [comment, ...],
      comment.article_id == ^article_id and comment.inner_id > ^after_id and
        as(:gate_community).id == ^community.id
    )
    |> where(
      [comment, ...],
      fragment("? IS NOT DISTINCT FROM ?", comment.branch_id, ^branch_id)
    )
    |> join(:left, [comment, ...], mention in ArtimentMention,
      on:
        mention.mentioned_scope == :internal and
          (mention.mentioner_comment_id == comment.id or
             mention.mentioned_comment_id == comment.id),
      as: :reference_mention
    )
    |> join(:left, [comment, ...], state in SyncState,
      on: state.source_type == :comment and state.source_comment_id == comment.id,
      as: :reference_sync_state
    )
    |> where(
      [comment, ...],
      not is_nil(as(:reference_mention).id) or
        is_nil(as(:reference_sync_state).id) or
        is_nil(as(:reference_sync_state).synced_content_token) or
        as(:reference_sync_state).desired_content_token !=
          as(:reference_sync_state).synced_content_token
    )
    |> select([comment, ...], comment.inner_id)
    |> distinct(true)
    |> order_by([comment, ...], asc: comment.inner_id)
    |> limit(^limit)
    |> Repo.all()
  end

  defp distinct(results) do
    keys = for {:ok, node} <- results, do: node.key
    if Enum.uniq(keys) == keys, do: {:ok, :pass}, else: {:error, "duplicate frontier"}
  end

  defp distinct_inputs(frontiers) do
    nodes = Enum.map(frontiers, & &1.node)
    if Enum.uniq(nodes) == nodes, do: {:ok, :pass}, else: {:error, "duplicate frontier"}
  end

  defp decode_frontiers(community_id, inputs, resolved) do
    inputs
    |> Enum.zip(resolved)
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn
      {{input, {:ok, node}}, index}, {:ok, acc} ->
        case decode_cursor(Map.get(input, :after), community_id, node.key) do
          {:ok, after_key} -> {:cont, {:ok, [{index, node, after_key} | acc]}}
          error -> {:halt, error}
        end

      {{_, {:error, _}}, _index}, {:ok, acc} ->
        {:cont, {:ok, acc}}
    end)
    |> case do
      {:ok, acc} -> {:ok, Enum.reverse(acc)}
      error -> error
    end
  end

  defp scan_frontiers(context, _inputs, [], _first), do: %{context | facts: []}

  defp scan_frontiers(context, inputs, decoded, first) do
    states =
      Map.new(decoded, fn {index, node, after_key} ->
        {index, %{node: node, after_key: after_key, facts: [], done: false}}
      end)

    scan_window(context, inputs, states, first, 0)
  end

  defp scan_window(context, inputs, states, first, iterations) do
    active =
      for {index, state} <- states, not state.done do
        {index, state.node, state.after_key}
      end

    if active == [] do
      selected = states |> Map.values() |> Enum.flat_map(& &1.facts) |> Enum.uniq_by(& &1.id)

      if iterations > 1 do
        {:ok, final_context, _} = ReadModel.load(context.community, inputs, {:facts, selected})
        %{final_context | facts: selected}
      else
        %{context | facts: selected}
      end
    else
      rows = PageFacts.raw_window(active)
      candidates = rows |> Enum.map(fn {_, fact, _} -> fact end) |> Enum.uniq_by(& &1.id)

      candidate_context =
        if candidates == [] do
          context
        else
          {:ok, loaded, _} = ReadModel.load(context.community, inputs, {:facts, candidates})
          loaded
        end

      grouped = Enum.group_by(rows, fn {index, _, _} -> index end)

      states =
        Map.new(states, fn {index, state} ->
          if state.done do
            {index, state}
          else
            window = Map.get(grouped, index, [])

            public_facts =
              window
              |> Enum.flat_map(fn {_, fact, _} ->
                if project_edge(candidate_context, fact, state.node) == [], do: [], else: [fact]
              end)

            facts = Enum.take(state.facts ++ public_facts, first + 1)
            last_key = window |> List.last() |> then(fn row -> row && elem(row, 2) end)

            {index,
             %{
               state
               | facts: facts,
                 after_key: last_key || state.after_key,
                 done: length(facts) > first or length(window) < 40
             }}
          end
        end)

      scan_window(candidate_context, inputs, states, first, iterations + 1)
    end
  end

  defp neighborhoods(context, frontiers, resolved, first) do
    Enum.zip(frontiers, resolved)
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, [], %{}, %{}}, fn
      {{_input, {:error, _}}, index}, {:ok, neighborhoods, nodes, edges} ->
        neighborhood = %{
          request_index: index,
          state: :unavailable,
          node_id: nil,
          edge_ids: [],
          has_next_page: false,
          end_cursor: nil
        }

        {:cont, {:ok, neighborhoods ++ [neighborhood], nodes, edges}}

      {{input, {:ok, frontier}}, index}, {:ok, neighborhoods, nodes, edges} ->
        with {:ok, after_key} <-
               decode_cursor(Map.get(input, :after), context.community.id, frontier.key) do
          items =
            context.facts
            |> Enum.flat_map(&project_edge(context, &1, frontier))
            |> Enum.sort_by(& &1.sort_key)
            |> Enum.filter(fn item -> is_nil(after_key) or item.sort_key > after_key end)

          selected = Enum.take(items, first)
          more = length(items) > first

          cursor =
            if more and selected != [],
              do: encode_cursor(context.community.id, frontier.key, List.last(selected).sort_key)

          neighborhood = %{
            request_index: index,
            state: :available,
            node_id: frontier.id,
            edge_ids: Enum.map(selected, & &1.edge.id),
            has_next_page: more,
            end_cursor: cursor
          }

          {nodes, edges} =
            Enum.reduce(selected, {Map.put(nodes, frontier.id, frontier), edges}, fn item,
                                                                                     {ns, es} ->
              {Map.put(ns, item.other.id, item.other), Map.put(es, item.edge.id, item.edge)}
            end)

          {:cont, {:ok, neighborhoods ++ [neighborhood], nodes, edges}}
        else
          error -> {:halt, error}
        end
    end)
  end

  defp project_edge(context, fact, frontier) do
    with {:ok, from} <-
           ReadModel.node(
             context,
             fact.mentioner_type,
             fact.mentioner_article_id,
             fact.mentioner_comment_id,
             fact.mentioner_branch_id
           ),
         true <- from.sync_state == :ready,
         {:ok, to} <-
           ReadModel.node(
             context,
             fact.mentioned_type,
             fact.mentioned_article_id,
             fact.mentioned_comment_id,
             fact.mentioned_branch_id
           ),
         true <- from.id == frontier.id or to.id == frontier.id do
      if from.id == to.id and from.type != :comment do
        []
      else
        key = fact.edge_key

        edge = %{
          id: Opaque.id(:edge, context.community.id, key),
          from: from.id,
          to: to.id,
          occurrences_count: max(length(fact.occurrences || []), 1)
        }

        other = if from.id == frontier.id, do: to, else: from
        [%{edge: edge, other: other, sort_key: key}]
      end
    else
      _ -> []
    end
  end

  defp cursor_key do
    key = Application.fetch_env!(:groupher_server, :reference_map_key)
    :crypto.hash(:sha256, "reference-map-cursor:" <> key)
  end

  defp encode_cursor(community_id, frontier_key, last_key) do
    nonce = :crypto.strong_rand_bytes(12)
    payload = :erlang.term_to_binary({Opaque.version(), community_id, frontier_key, last_key})

    {cipher, tag} =
      :crypto.crypto_one_time_aead(
        :aes_256_gcm,
        cursor_key(),
        nonce,
        payload,
        "reference-map",
        true
      )

    Base.url_encode64(nonce <> tag <> cipher, padding: false)
  end

  defp decode_cursor(nil, _, _), do: {:ok, nil}

  defp decode_cursor(cursor, community_id, frontier_key)
       when is_binary(cursor) and byte_size(cursor) <= 4096 do
    with {:ok, <<nonce::binary-size(12), tag::binary-size(16), cipher::binary>>} <-
           Base.url_decode64(cursor, padding: false),
         payload when is_binary(payload) <-
           :crypto.crypto_one_time_aead(
             :aes_256_gcm,
             cursor_key(),
             nonce,
             cipher,
             "reference-map",
             tag,
             false
           ),
         {version, ^community_id, ^frontier_key, last_key} <-
           :erlang.binary_to_term(payload, [:safe]) do
      if version == Opaque.version(), do: {:ok, last_key}, else: {:error, "invalid cursor"}
    else
      _ -> {:error, "invalid cursor"}
    end
  rescue
    _ -> {:error, "invalid cursor"}
  end

  defp decode_cursor(_, _, _), do: {:error, "invalid cursor"}
end
