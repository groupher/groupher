defmodule GroupherServer.CMS.ArtimentMentions.ReferenceMap.ReadModel do
  @moduledoc """
  Batches public Gate, binding, head and watermark reads for a Map page.

      candidate identities -> anonymous Gate scopes -> current node projection
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.{Opaque, PublicUrl}
  alias CMS.ArtimentMentions.Model.SyncState
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Comment, as: CommentScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Gate.Context.Scope.Ticket, as: TicketScope

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArtimentMention,
    Comment,
    CommentBody,
    DocBranch,
    DocPublic,
    TicketState
  }

  @article_types [:post, :blog, :changelog, :doc, :ticket]

  def load(community, inputs, endpoint_source \\ true) do
    with {:ok, locators} <- parse_inputs(inputs) do
      inner_ids = locators |> Enum.map(& &1.article_inner_id) |> Enum.uniq()

      bindings =
        Repo.all(
          from(b in ArticleBinding,
            where: b.community_id == ^community.id and b.inner_id in ^inner_ids
          )
        )

      binding_by_inner = Map.new(bindings, &{&1.inner_id, &1})
      input_article_ids = Enum.map(bindings, & &1.article_id)
      input_comment_ids = Enum.map(locators, & &1.comment_inner_id) |> Enum.reject(&is_nil/1)

      input_comments =
        Repo.all(
          from(c in Comment,
            where: c.article_id in ^input_article_ids and c.inner_id in ^input_comment_ids
          )
        )

      input_comment_by_locator = Map.new(input_comments, &{{&1.article_id, &1.inner_id}, &1})

      tentative =
        Enum.map(locators, fn locator ->
          binding = binding_by_inner[locator.article_inner_id]

          comment =
            binding && input_comment_by_locator[{binding.article_id, locator.comment_inner_id}]

          {locator, binding, comment}
        end)

      source_article_ids =
        tentative
        |> Enum.reject(fn {_, binding, _} -> is_nil(binding) end)
        |> Enum.map(fn {_, binding, _} -> binding.article_id end)

      source_comment_ids =
        tentative
        |> Enum.map(fn {_, _, comment} -> comment && comment.id end)
        |> Enum.reject(&is_nil/1)

      {fact_article_ids, fact_comment_ids} =
        case endpoint_source do
          true -> endpoints(source_article_ids, source_comment_ids)
          false -> {[], []}
          {:facts, facts} -> fact_endpoints(facts)
        end

      comments =
        Repo.all(from(c in Comment, where: c.id in ^fact_comment_ids))
        |> then(&Map.new(&1, fn comment -> {comment.id, comment} end))

      all_comments = Map.merge(comments, Map.new(input_comments, &{&1.id, &1}))

      article_ids =
        (source_article_ids ++
           fact_article_ids ++ Enum.map(Map.values(all_comments), & &1.article_id))
        |> Enum.reject(&is_nil/1)
        |> Enum.uniq()

      articles =
        Repo.all(from(a in Article, where: a.id in ^article_ids))
        |> then(&Map.new(&1, fn article -> {article.id, article} end))

      bindings =
        Repo.all(
          from(b in ArticleBinding,
            where: b.community_id == ^community.id and b.article_id in ^article_ids
          )
        )
        |> then(&Map.new(&1, fn binding -> {binding.article_id, binding} end))

      visible = visible(community, article_ids, Map.keys(all_comments))

      publics =
        Repo.all(from(p in ArticlePublic, where: p.article_id in ^article_ids))
        |> then(&Map.new(&1, fn public -> {public.article_id, public} end))

      docs =
        Repo.all(
          from(p in DocPublic,
            join: branch in DocBranch,
            on:
              branch.id == p.branch_id and branch.type == :main and
                branch.community_id == ^community.id,
            where: p.article_id in ^article_ids,
            select: p
          )
        )
        |> then(&Map.new(&1, fn public -> {public.article_id, public} end))

      comment_bodies =
        Repo.all(from(b in CommentBody, where: b.comment_id in ^Map.keys(all_comments)))
        |> then(&Map.new(&1, fn body -> {body.comment_id, body} end))

      states =
        Repo.all(
          from(s in SyncState,
            where:
              s.source_article_id in ^article_ids or
                s.source_comment_id in ^Map.keys(all_comments)
          )
        )
        |> Map.new(fn state ->
          key =
            if state.source_type == :comment,
              do: {:comment, state.source_comment_id, nil},
              else: {state.source_type, state.source_article_id, state.source_branch_id}

          {key, state}
        end)

      context = %{
        community: community,
        articles: articles,
        bindings: bindings,
        comments: all_comments,
        visible: visible,
        publics: publics,
        docs: docs,
        comment_bodies: comment_bodies,
        states: states,
        facts: []
      }

      resolved =
        Enum.map(tentative, fn {locator, binding, comment} ->
          resolve_input(context, locator, binding, comment)
        end)

      {:ok, context, resolved}
    end
  end

  def node(context, :comment, _article_id, comment_id, branch_id) do
    with %Comment{} = comment <- context.comments[comment_id],
         %Article{} = parent <- context.articles[comment.article_id],
         true <- comment.branch_id == branch_id,
         true <- MapSet.member?(context.visible.comments, comment_id),
         true <- visible_article?(context, parent.thread, parent.id, branch_id),
         %ArticleBinding{} = binding <- context.bindings[parent.id],
         {:ok, parent_path} <-
           article_path(context, parent.thread, parent.id, branch_id, binding.inner_id),
         url when is_binary(url) <- PublicUrl.comment(parent_path, comment.inner_id) do
      body = context.comment_bodies[comment_id]
      title = if body, do: String.slice(body.digest || "", 0, 140), else: ""

      {:ok,
       build_node(
         context,
         :comment,
         nil,
         comment_id,
         branch_id,
         binding.inner_id,
         comment.inner_id,
         title,
         url
       )}
    else
      _ -> {:error, :unavailable}
    end
  end

  def node(context, type, article_id, nil, branch_id) when type in @article_types do
    with %Article{thread: ^type} <- context.articles[article_id],
         true <- visible_article?(context, type, article_id, branch_id),
         %ArticleBinding{inner_id: inner_id} <- context.bindings[article_id],
         {:ok, path} <- article_path(context, type, article_id, branch_id, inner_id),
         url when is_binary(url) <- PublicUrl.article(path) do
      title =
        if type == :doc,
          do: context.docs[article_id].title || "",
          else: context.publics[article_id].title || ""

      {:ok, build_node(context, type, article_id, nil, branch_id, inner_id, nil, title, url)}
    else
      _ -> {:error, :unavailable}
    end
  end

  def node(_, _, _, _, _), do: {:error, :unavailable}

  def public_pending_source?(_community, []), do: false

  def public_pending_source?(community, candidates) do
    article_ids =
      candidates
      |> Enum.map(fn {_, article_id, _, _} -> article_id end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    comment_ids =
      candidates
      |> Enum.map(fn {_, _, comment_id, _} -> comment_id end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    comments = Repo.all(from(c in Comment, where: c.id in ^comment_ids))
    comments_by_id = Map.new(comments, &{&1.id, &1})
    parent_ids = Enum.map(comments, & &1.article_id)
    visible = visible(community, Enum.uniq(article_ids ++ parent_ids), comment_ids)

    articles =
      Repo.all(from(a in Article, where: a.id in ^Enum.uniq(article_ids ++ parent_ids)))
      |> Map.new(&{&1.id, &1})

    Enum.any?(candidates, fn
      {:comment, _, comment_id, branch_id} ->
        case comments_by_id[comment_id] do
          %Comment{article_id: parent_id, branch_id: ^branch_id} ->
            parent = articles[parent_id]

            MapSet.member?(visible.comments, comment_id) and
              parent != nil and
              visible_article_from_scope?(visible, parent.thread, parent_id, branch_id)

          _ ->
            false
        end

      {type, article_id, nil, branch_id} ->
        visible_article_from_scope?(visible, type, article_id, branch_id)

      _ ->
        false
    end)
  end

  defp visible_article_from_scope?(visible, :doc, article_id, branch_id),
    do: MapSet.member?(visible.docs, {article_id, branch_id})

  defp visible_article_from_scope?(visible, :ticket, article_id, nil),
    do: MapSet.member?(visible.tickets, article_id)

  defp visible_article_from_scope?(visible, type, article_id, nil),
    do: MapSet.member?(visible.articles, {type, article_id})

  defp visible_article_from_scope?(_, _, _, _), do: false

  def ready?(context, %{type: type, key: {_, article_id, comment_id, branch_id}}) do
    state_key =
      if type == :comment, do: {:comment, comment_id, nil}, else: {type, article_id, branch_id}

    state = context.states[state_key]

    token =
      case type do
        :comment ->
          case context.comment_bodies[comment_id] do
            %CommentBody{version: version, body_hash: hash} ->
              "#{comment_id}:#{version}:#{hash}"

            _ ->
              nil
          end

        :doc ->
          case context.docs[article_id] do
            %DocPublic{
              branch_id: ^branch_id,
              branch_version_id: version_id,
              publication_version: version
            } ->
              "#{branch_id}:#{version_id}:#{version}"

            _ ->
              nil
          end

        _ ->
          case context.publics[article_id] do
            %ArticlePublic{revision_id: revision, publication_version: version} ->
              "#{revision}:#{version}"

            _ ->
              nil
          end
      end

    match?(%SyncState{desired_content_token: ^token, synced_content_token: ^token}, state) and
      is_binary(token)
  end

  def facts_by_ids(ids) do
    Repo.all(from(m in ArtimentMention, where: m.id in ^ids))
  end

  defp endpoints(article_ids, comment_ids) do
    sql = """
    WITH candidates AS (
      SELECT mentioner_article_id, mentioned_article_id,
             mentioner_comment_id, mentioned_comment_id
      FROM cms.artiment_mentions
      WHERE mentioned_scope = 'internal' AND
        (mentioner_article_id = ANY($1::uuid[]) OR
         mentioned_article_id = ANY($1::uuid[]) OR
         mentioner_comment_id = ANY($2::bigint[]) OR
         mentioned_comment_id = ANY($2::bigint[]))
    )
    SELECT ARRAY(SELECT DISTINCT mentioner_article_id FROM candidates WHERE mentioner_article_id IS NOT NULL),
           ARRAY(SELECT DISTINCT mentioned_article_id FROM candidates WHERE mentioned_article_id IS NOT NULL),
           ARRAY(SELECT DISTINCT mentioner_comment_id FROM candidates WHERE mentioner_comment_id IS NOT NULL),
           ARRAY(SELECT DISTINCT mentioned_comment_id FROM candidates WHERE mentioned_comment_id IS NOT NULL)
    """

    %{rows: [[source_articles, target_articles, source_comments, target_comments]]} =
      Repo.query!(sql, [Enum.map(article_ids, &Ecto.UUID.dump!/1), comment_ids])

    {Enum.uniq(source_articles ++ target_articles) |> Enum.map(&Ecto.UUID.load!/1),
     Enum.uniq(source_comments ++ target_comments)}
  end

  defp fact_endpoints(facts) do
    article_ids =
      facts
      |> Enum.flat_map(fn fact -> [fact.mentioner_article_id, fact.mentioned_article_id] end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    comment_ids =
      facts
      |> Enum.flat_map(fn fact -> [fact.mentioner_comment_id, fact.mentioned_comment_id] end)
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    {article_ids, comment_ids}
  end

  defp visible(community, article_ids, comment_ids) do
    ordinary =
      [:post, :blog, :changelog]
      |> Enum.flat_map(fn type ->
        CMS.Gate.scope(Article, nil, :read, ArticleScope.public(type))
        |> scope_query()
        |> where(
          [article, ...],
          article.id in ^article_ids and
            as(:gate_community).id == ^community.id
        )
        |> select([article], {article.thread, article.id})
        |> Repo.all()
      end)

    docs =
      CMS.Gate.scope(Article, nil, :read, DocScope.public_main())
      |> scope_query()
      |> where(
        [article, ...],
        article.id in ^article_ids and
          as(:gate_community).id == ^community.id
      )
      |> select([article], {article.id, as(:gate_doc_branch).id})
      |> Repo.all()

    tickets =
      CMS.Gate.scope(TicketState, nil, :read, TicketScope.public(community))
      |> scope_query()
      |> where([ticket_state: state], state.article_id in ^article_ids)
      |> select([ticket_state: state], state.article_id)
      |> Repo.all()

    comments =
      CMS.Gate.scope(Comment, nil, :read, CommentScope.all_public())
      |> scope_query()
      |> where(
        [comment, ...],
        comment.id in ^comment_ids and
          as(:gate_community).id == ^community.id
      )
      |> select([comment], comment.id)
      |> Repo.all()

    %{
      articles: MapSet.new(ordinary),
      docs: MapSet.new(docs),
      tickets: MapSet.new(tickets),
      comments: MapSet.new(comments)
    }
  end

  defp scope_query({:ok, %Ecto.Query{} = query}), do: query
  defp scope_query(%Ecto.Query{} = query), do: query

  defp visible_article?(context, :doc, article_id, branch_id),
    do: MapSet.member?(context.visible.docs, {article_id, branch_id})

  defp visible_article?(context, :ticket, article_id, nil),
    do: MapSet.member?(context.visible.tickets, article_id)

  defp visible_article?(context, type, article_id, nil),
    do: MapSet.member?(context.visible.articles, {type, article_id})

  defp visible_article?(_, _, _, _), do: false

  defp article_path(context, :doc, article_id, branch_id, inner_id) do
    case context.docs[article_id] do
      %DocPublic{branch_id: ^branch_id, slug: slug} ->
        {:ok,
         %{community_slug: context.community.slug, thread: :doc, inner_id: inner_id, slug: slug}}

      _ ->
        {:error, :unavailable}
    end
  end

  defp article_path(context, type, _article_id, nil, inner_id) do
    {:ok, %{community_slug: context.community.slug, thread: type, inner_id: inner_id}}
  end

  defp article_path(_, _, _, _, _), do: {:error, :unavailable}

  defp build_node(
         context,
         type,
         article_id,
         comment_id,
         branch_id,
         inner_id,
         comment_inner_id,
         title,
         url
       ) do
    key = {type, article_id, comment_id, branch_id}

    %{
      id: Opaque.id(:node, context.community.id, key),
      key: key,
      type: type,
      article_inner_id: inner_id,
      comment_inner_id: comment_inner_id,
      branch_id:
        if(type == :doc or (type == :comment and branch_id),
          do: Opaque.id(:branch, context.community.id, branch_id),
          else: nil
        ),
      title: title,
      url: url,
      sync_state: if(ready?(context, %{type: type, key: key}), do: :ready, else: :pending)
    }
  end

  defp resolve_input(_context, _locator, nil, _), do: {:error, :unavailable}

  defp resolve_input(_context, %{type: :comment}, _binding, nil),
    do: {:error, :unavailable}

  defp resolve_input(context, %{type: :comment}, _binding, comment),
    do: node(context, :comment, nil, comment.id, comment.branch_id)

  defp resolve_input(context, %{type: type}, binding, _comment) do
    branch_id =
      if type == :doc,
        do:
          context.docs[binding.article_id] &&
            context.docs[binding.article_id].branch_id,
        else: nil

    node(context, type, binding.article_id, nil, branch_id)
  end

  defp parse_inputs(inputs) do
    Enum.reduce_while(inputs, {:ok, []}, fn input, {:ok, acc} ->
      case parse_input(input) do
        {:ok, parsed} -> {:cont, {:ok, [parsed | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, parsed} -> {:ok, Enum.reverse(parsed)}
      error -> error
    end
  end

  defp parse_input(%{type: type, article_inner_id: raw} = input)
       when type in @article_types or type == :comment do
    with {:ok, article_inner_id} <- positive_id(raw),
         {:ok, comment_inner_id} <- comment_id(type, Map.get(input, :comment_inner_id)) do
      {:ok, %{type: type, article_inner_id: article_inner_id, comment_inner_id: comment_inner_id}}
    end
  end

  defp parse_input(_), do: {:error, "invalid locator"}

  defp comment_id(:comment, raw), do: positive_id(raw)
  defp comment_id(_, nil), do: {:ok, nil}
  defp comment_id(_, _), do: {:error, "invalid locator"}

  defp positive_id(value) when is_integer(value) and value > 0 and value <= 2_147_483_647,
    do: {:ok, value}

  defp positive_id(value) when is_binary(value) do
    if Regex.match?(~r/\A[1-9][0-9]*\z/, value) do
      case Integer.parse(value) do
        {id, ""} when id <= 2_147_483_647 -> {:ok, id}
        _ -> {:error, "invalid locator"}
      end
    else
      {:error, "invalid locator"}
    end
  end

  defp positive_id(_), do: {:error, "invalid locator"}
end
