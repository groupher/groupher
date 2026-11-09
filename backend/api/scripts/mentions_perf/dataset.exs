defmodule MentionsPerf.Dataset do
  @moduledoc """
  Builds an isolated relational workload with live canonical six-type resources.

      test Commands -> canonical resources -> offline current-edge fixture

  This is a controlled capacity envelope, not a copy of target bodies or proof of
  target representativeness. Direct fixture edge construction tests reads;
  Command capture correctness has separate joint acceptance coverage.
  """
  import Ecto.Query
  import GroupherServer.Support.Factory
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Mentions.{Edge, Endpoint}

  def build(per_type, catalog \\ nil) do
    if Repo.aggregate(CMS.Model.Article, :count) != 0 or
         Repo.aggregate(CMS.Model.Comment, :count) != 0 or
         Repo.aggregate(CMS.Model.Community, :count) != 0 do
      raise "Performance fixture requires an empty owned database; never deletes existing content"
    end

    {:ok, user} = db_insert(:user, login: "xx")
    communities = for _ <- 1..3, do: elem(mock_community(user), 1)

    article_counts =
      if catalog,
        do: Map.new(catalog["article_types"], fn [type, count] -> {type, count} end),
        else: %{}

    if not is_nil(catalog) and
         Enum.any?(~w(post blog changelog doc ticket), &(Map.get(article_counts, &1, 0) < 1)) do
      raise "Catalog lacks a six-type exemplar; use a separate coverage envelope instead of inventing catalog counts"
    end

    articles =
      for thread <- [:post, :blog, :changelog, :doc],
          index <- sequence(Map.get(article_counts, to_string(thread), per_type)) do
        count = Map.get(article_counts, to_string(thread), per_type)

        community =
          Enum.at(
            communities,
            if(index <= max(div(count * 3, 4), 1), do: 0, else: 1 + rem(index, 2))
          )

        {_, article, _, _} = mock_article(thread, community, user)

        entry(
          thread,
          article.article_id,
          nil,
          community,
          article_inner_id(article, community),
          article
        )
      end

    main = hd(communities)
    posts = Enum.filter(articles, &(&1.type == :post and &1.community.id == main.id))
    ticket_count = Map.get(article_counts, "ticket", max(div(per_type, 4), 1))
    tickets = for post <- Enum.take(posts, ticket_count), do: ticket(post, user)

    comment_parents =
      if catalog do
        Enum.flat_map(catalog["comment_types"], fn [thread, count] ->
          parents = Enum.filter(articles, &(to_string(&1.type) == thread))

          for index <- sequence(count),
              do: {Enum.at(parents, rem(index - 1, length(parents))), index}
        end)
      else
        for article <- articles, index <- 1..4, do: {article, index}
      end

    comments =
      for {article, index} <- comment_parents do
        {:ok, comment} =
          CMS.Comments.create_comment(
            article.community,
            article.type,
            article.locator.article_inner_id,
            mock_comment("Performance fixture comment #{index}"),
            user,
            Ecto.UUID.generate()
          )

        entry(
          :comment,
          article.article_id,
          comment.id,
          article.community,
          article.locator.article_inner_id,
          comment
        )
      end

    entries = articles ++ tickets ++ comments
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    # Canonical resources come from Commands. Only relationship construction is offline.
    for {source, index} <- Enum.with_index(entries) do
      rows =
        entries
        |> targets(index)
        |> Enum.map(fn target ->
          %{
            id: Ecto.UUID.generate(),
            source_endpoint_id: source.endpoint_id,
            target_type: target.type,
            target_endpoint_id: target.endpoint_id,
            mention_case: :inline_mention,
            edge_key: "capacity:#{source.endpoint_id}:#{target.endpoint_id}",
            mentioned_at: now,
            occurrences_count: 1,
            inserted_at: now,
            updated_at: now
          }
        end)

      Repo.insert_all(Edge, rows)
    end

    # Keep focus exemplars readable; make hidden tails reproducible.
    dense_hidden = System.get_env("CMS_MENTIONS_PERF_HIDDEN_STRESS") == "1"

    hidden =
      if dense_hidden do
        articles |> Enum.group_by(& &1.type) |> Map.values() |> Enum.flat_map(&Enum.drop(&1, 1))
      else
        Enum.filter(entries, &(&1.type == :post))
        |> Enum.drop(5)
        |> Enum.take(max(div(per_type, 4), 1))
      end

    for source <- hidden do
      if source.type == :doc do
        Repo.update_all(
          from(l in CMS.Model.DocLifecycle, where: l.article_id == ^source.article_id),
          set: [state: :draft]
        )
      else
        Repo.update_all(
          from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^source.article_id),
          set: [state: :archived]
        )
      end
    end

    # ANALYZE is confined to this freshly created local fixture database.
    Ecto.Adapters.SQL.query!(Repo, "ANALYZE", [])
    hidden_ids = MapSet.new(hidden, & &1.article_id)

    selected =
      Enum.filter(
        entries,
        &(&1.community.id == main.id and not MapSet.member?(hidden_ids, &1.article_id))
      )

    exemplar = fn type ->
      Enum.find(selected, &(&1.type == type)) ||
        raise("Performance fixture requires a readable #{type} exemplar")
    end

    %{
      community: main.slug,
      entries: entries,
      focus: exemplar.(:post).locator,
      doc: exemplar.(:doc).locator,
      comment: exemplar.(:comment).locator,
      summary: %{
        kind:
          if(catalog,
            do: "target-source-counts-relational-envelope",
            else: "controlled-relational-envelope"
          ),
        per_type: per_type,
        canonical_sources: length(entries),
        resource_types: Enum.frequencies_by(entries, & &1.type),
        communities: 3,
        hidden_article_sources: length(hidden),
        dense_hidden: dense_hidden,
        pending_comment_sources: 0,
        current_edges: Repo.aggregate(Edge, :count),
        body_capture_representative: false
      }
    }
  end

  defp sequence(0), do: []
  defp sequence(count) when count in 1..500, do: Enum.to_list(1..count)

  defp article_inner_id(%{inner_id: id}, _community), do: id

  defp article_inner_id(%{article_id: id}, community) do
    Repo.get_by!(CMS.Model.ArticleBinding, article_id: id, community_id: community.id).inner_id
  end

  defp entry(type, article_id, comment_id, community, inner_id, content) do
    endpoint =
      if type == :comment do
        Repo.get_by!(Endpoint, type: type, comment_id: comment_id)
      else
        Repo.get_by!(Endpoint, type: type, article_id: article_id)
      end

    locator = %{type: type, article_inner_id: inner_id}

    locator =
      if type == :comment,
        do: Map.put(locator, :comment_inner_id, content.inner_id),
        else: locator

    %{
      type: type,
      article_id: article_id,
      endpoint_id: endpoint.id,
      community: community,
      locator: locator
    }
  end

  defp ticket(post, user) do
    grants = Map.new(~w(ticket.create ticket.read_internal ticket.manage_visibility), &{&1, true})
    actor = %{user | cur_passport: %{"global" => %{}, post.community.slug => %{"cms" => grants}}}

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        post.community,
        post.article_id,
        %{title: "Capacity fixture ticket"},
        actor,
        Ecto.UUID.generate()
      )

    {:ok, draft} = CMS.Tickets.get_internal(post.community, ticket.id, actor)

    {:ok, _} =
      CMS.Tickets.publish(
        post.community,
        ticket.id,
        "Capacity fixture",
        draft.draft_version,
        draft.lifecycle_version,
        draft.workflow_version,
        actor,
        Ecto.UUID.generate(),
        CMS.Tickets.Publication.preview_anchor(post.community.id, ticket.id)
      )

    {:ok, ticket} = CMS.Tickets.get_internal(post.community, ticket.id, actor)
    entry(:ticket, ticket.id, nil, post.community, ticket.inner_id, ticket)
  end

  defp targets(entries, index) do
    count = length(entries)
    # Dense hubs plus a deterministic long tail; incoming and outgoing hotspots coexist.
    positions =
      if rem(index, 64) == 0 do
        Enum.to_list(0..(count - 1))
      else
        [0, 1] ++ Enum.map(1..(4 + rem(index, 20)), &rem(index * 31 + &1 * 17, count))
      end

    positions |> Enum.uniq() |> Enum.reject(&(&1 == index)) |> Enum.map(&Enum.at(entries, &1))
  end
end
