defmodule GroupherServer.CMS.ArtimentMentions.PublicList do
  @moduledoc """
  Projects one-hop facts through the request Community's anonymous public Gate.

      stable Mention facts -> both endpoint public reads -> one-hop DTO page
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

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Pagi.Params
  alias Helper.ORM.Pagi.Page

  @article_types [:post, :blog, :changelog, :doc, :ticket]

  def list(direction, type, id, community_slug, pagi) do
    with {:ok, %CMS.Model.Community{} = community} <- CMS.FrontDesk.community(community_slug),
         {:ok, page_request} <- page_request(pagi) do
      case facts_query(direction, type, id) do
        nil ->
          page_from_entries([], page_request)

        query ->
          query = filter_public_endpoint(query, direction, community)

          read_page(fn -> stream_page(query, community, page_request, direction) end)
      end
    end
  end

  defp read_page(fun) do
    if Repo.in_transaction?() do
      fun.()
    else
      case Repo.transaction(fn ->
             unless Application.get_env(:groupher_server, :reference_map_test_sandbox, false) do
               Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
             end

             fun.()
           end) do
        {:ok, result} -> result
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp facts_query(:outgoing, type, id) when type in @article_types do
    from(m in ArtimentMention,
      where: m.mentioner_type == ^type and m.mentioner_article_id == ^id,
      order_by: [asc: m.edge_key]
    )
  end

  defp facts_query(:outgoing, :comment, id) do
    from(m in ArtimentMention,
      where: m.mentioner_type == :comment and m.mentioner_comment_id == ^id,
      order_by: [asc: m.edge_key]
    )
  end

  defp facts_query(:incoming, type, id) when type in @article_types do
    from(m in ArtimentMention,
      where:
        m.mentioned_scope == :internal and m.mentioned_type == ^type and
          m.mentioned_article_id == ^id,
      order_by: [asc: m.edge_key]
    )
  end

  defp facts_query(:incoming, :comment, id) do
    from(m in ArtimentMention,
      where:
        m.mentioned_scope == :internal and m.mentioned_type == :comment and
          m.mentioned_comment_id == ^id,
      order_by: [asc: m.edge_key]
    )
  end

  defp facts_query(:incoming, :user, id) do
    from(m in ArtimentMention,
      where:
        m.mentioned_scope == :internal and m.mentioned_type == :user and
          m.mentioned_user_id == ^id,
      order_by: [asc: m.edge_key]
    )
  end

  defp facts_query(_, _, _), do: nil

  defp filter_public_endpoint(query, direction, community) do
    visible = public_endpoint_condition(community, direction)
    where(query, [mention], ^visible)
  end

  defp public_endpoint_condition(community, :outgoing) do
    Enum.reduce(
      [:post, :blog, :changelog, :doc, :ticket, :comment],
      dynamic([m], m.mentioned_scope == :external or m.mentioned_type == :user),
      fn type, condition ->
        ids = public_ids(type, community)

        if type == :comment do
          dynamic(
            [m],
            ^condition or
              (m.mentioned_type == :comment and m.mentioned_comment_id in subquery(ids))
          )
        else
          dynamic(
            [m],
            ^condition or
              (m.mentioned_type == ^type and m.mentioned_article_id in subquery(ids))
          )
        end
      end
    )
  end

  defp public_endpoint_condition(community, :incoming) do
    Enum.reduce([:post, :blog, :changelog, :doc, :ticket, :comment], dynamic(false), fn type,
                                                                                        condition ->
      ids = public_ids(type, community)

      if type == :comment do
        dynamic(
          [m],
          ^condition or
            (m.mentioner_type == :comment and m.mentioner_comment_id in subquery(ids))
        )
      else
        dynamic(
          [m],
          ^condition or
            (m.mentioner_type == ^type and m.mentioner_article_id in subquery(ids))
        )
      end
    end)
  end

  defp public_ids(:comment, community) do
    CMS.Gate.scope(Comment, nil, :read, CommentScope.all_public())
    |> scope_query()
    |> where([comment, ...], as(:gate_community).id == ^community.id)
    |> select([comment], comment.id)
  end

  defp public_ids(:doc, community) do
    CMS.Gate.scope(Article, nil, :read, DocScope.public_main())
    |> scope_query()
    |> where([article, ...], as(:gate_community).id == ^community.id)
    |> select([article], article.id)
  end

  defp public_ids(:ticket, community) do
    CMS.Gate.scope(TicketState, nil, :read, TicketScope.public(community))
    |> scope_query()
    |> select([ticket_state: state], state.article_id)
  end

  defp public_ids(type, community) do
    CMS.Gate.scope(Article, nil, :read, ArticleScope.public(type))
    |> scope_query()
    |> where([article, ...], as(:gate_community).id == ^community.id)
    |> select([article], article.id)
  end

  defp scope_query({:ok, %Ecto.Query{} = query}), do: query
  defp scope_query(%Ecto.Query{} = query), do: query

  defp project(mention, community, source) do
    with {:ok, from_url} <- source,
         {:ok, to_url} <- target_url(mention, community) do
      [
        %{
          id: Opaque.id(:edge, community.id, mention.edge_key),
          mentioner_type: mention.mentioner_type,
          mentioner_url: from_url,
          mentioned_scope: mention.mentioned_scope,
          mentioned_type: mention.mentioned_type,
          mentioned_url: to_url,
          mention_case: mention.mention_case,
          occurrences_count: length(mention.occurrences),
          mentioned_at: mention.mentioned_at
        }
      ]
    else
      _ -> []
    end
  end

  defp source_url(mention, community) do
    if source_ready?(mention) do
      projected_url(
        mention.mentioner_type,
        mention.mentioner_article_id,
        mention.mentioner_comment_id,
        mention.mentioner_branch_id,
        community
      )
    else
      {:error, :unavailable}
    end
  end

  def source_ready?(%{mentioner_type: :comment, mentioner_comment_id: id}) do
    with %SyncState{} = state <- Repo.get_by(SyncState, source_comment_id: id),
         %CommentBody{version: version, body_hash: hash} <-
           Repo.get_by(CommentBody, comment_id: id) do
      state.desired_content_token == state.synced_content_token and
        state.synced_content_token == "#{id}:#{version}:#{hash}"
    else
      _ -> false
    end
  end

  def source_ready?(%{
        mentioner_type: :doc,
        mentioner_article_id: id,
        mentioner_branch_id: branch
      }) do
    with %SyncState{} = state <-
           Repo.get_by(SyncState, source_article_id: id, source_branch_id: branch),
         %DocPublic{branch_version_id: version_id, publication_version: version} <-
           Repo.get_by(DocPublic, article_id: id, branch_id: branch) do
      state.desired_content_token == state.synced_content_token and
        state.synced_content_token == "#{branch}:#{version_id}:#{version}"
    else
      _ -> false
    end
  end

  def source_ready?(%{mentioner_article_id: id}) do
    with %SyncState{} = state <-
           Repo.one(
             from(state in SyncState,
               where: state.source_article_id == ^id and is_nil(state.source_branch_id)
             )
           ),
         %ArticlePublic{revision_id: revision_id, publication_version: version} <-
           Repo.get(ArticlePublic, id) do
      state.desired_content_token == state.synced_content_token and
        state.synced_content_token == "#{revision_id}:#{version}"
    else
      _ -> false
    end
  end

  defp target_url(%{mentioned_scope: :external, external_url: url}, _community)
       when is_binary(url), do: {:ok, url}

  defp target_url(%{mentioned_type: :user, mentioned_user_id: id}, _community) do
    case Repo.get(User, id) do
      %User{login: login} when is_binary(login) ->
        case GroupherServer.FrontDesk.user(login) do
          {:ok, _public_user} -> {:ok, "/u/#{URI.encode(login)}"}
          _ -> {:error, :unavailable}
        end

      _ ->
        {:error, :unavailable}
    end
  end

  defp target_url(mention, community) do
    projected_url(
      mention.mentioned_type,
      mention.mentioned_article_id,
      mention.mentioned_comment_id,
      mention.mentioned_branch_id,
      community
    )
  end

  defp projected_url(:comment, _article_id, comment_id, branch_id, community) do
    with %Comment{} = comment <- Repo.get(Comment, comment_id),
         true <- comment.branch_id == branch_id,
         %Article{} = parent <- Repo.get(Article, comment.article_id),
         {:ok, parent_path} <- article_path(parent.thread, parent.id, branch_id, community),
         url when is_binary(url) <- PublicUrl.comment(parent_path, comment.inner_id) do
      {:ok, url}
    else
      _ -> {:error, :unavailable}
    end
  end

  defp projected_url(type, article_id, _comment_id, branch_id, community)
       when type in @article_types do
    with {:ok, path} <- article_path(type, article_id, branch_id, community),
         url when is_binary(url) <- PublicUrl.article(path) do
      {:ok, url}
    else
      _ -> {:error, :unavailable}
    end
  end

  defp projected_url(_, _, _, _, _), do: {:error, :unavailable}

  defp project_with_cache(fact, community, :outgoing, nil) do
    source = source_url(fact, community)
    {project(fact, community, source), source}
  end

  defp project_with_cache(fact, community, :outgoing, source) do
    {project(fact, community, source), source}
  end

  defp project_with_cache(fact, community, :incoming, _cache) do
    {project(fact, community, source_url(fact, community)), nil}
  end

  def public_url(:comment, _article_id, comment_id, branch_id, community) do
    with %Comment{} = comment <- Repo.get(Comment, comment_id),
         true <- comment.branch_id == branch_id,
         %Article{} = parent <- Repo.get(Article, comment.article_id),
         {:ok, parent_path} <- article_path(parent.thread, parent.id, branch_id, community),
         path = %{
           article: %{
             community: community.slug,
             thread: parent.thread,
             inner_id: parent_path.inner_id
           },
           inner_id: comment.inner_id
         },
         {:ok, _visible} <- CMS.FrontDesk.comment(path),
         url when is_binary(url) <- PublicUrl.comment(parent_path, comment.inner_id) do
      {:ok, url}
    else
      _ -> {:error, :unavailable}
    end
  end

  def public_url(type, article_id, _comment_id, branch_id, community)
      when type in @article_types do
    with {:ok, path} <- article_path(type, article_id, branch_id, community),
         {:ok, _visible} <- readable_article(type, path, community),
         url when is_binary(url) <- PublicUrl.article(path) do
      {:ok, url}
    else
      _ -> {:error, :unavailable}
    end
  end

  def public_url(_, _, _, _, _), do: {:error, :unavailable}

  defp readable_article(:ticket, path, community),
    do: CMS.Tickets.get_public(community, path.inner_id)

  defp readable_article(type, path, _community),
    do:
      CMS.FrontDesk.article(%{
        community: path.community_slug,
        thread: type,
        inner_id: path.inner_id
      })

  defp article_path(type, article_id, branch_id, community) do
    with %ArticleBinding{inner_id: inner_id} <-
           Repo.get_by(ArticleBinding, article_id: article_id, community_id: community.id),
         {:ok, slug} <- doc_slug(type, article_id, branch_id, community) do
      {:ok, %{community_slug: community.slug, thread: type, inner_id: inner_id, slug: slug}}
    else
      _ -> {:error, :unavailable}
    end
  end

  defp doc_slug(:doc, article_id, branch_id, community) when is_integer(branch_id) do
    with %DocBranch{type: :main, community_id: community_id} <- Repo.get(DocBranch, branch_id),
         true <- community_id == community.id,
         %DocPublic{slug: slug} <-
           Repo.get_by(DocPublic, article_id: article_id, branch_id: branch_id) do
      {:ok, slug}
    else
      _ -> {:error, :unavailable}
    end
  end

  defp doc_slug(:doc, _, _, _), do: {:error, :unavailable}
  defp doc_slug(_type, _, nil, _), do: {:ok, nil}
  defp doc_slug(_, _, _, _), do: {:error, :unavailable}

  defp page_request(nil), do: page_request(%Params.Offset{page: 1, size: 20})

  defp page_request(%Params.Offset{page: page, size: size})
       when is_integer(page) and page > 0 and is_integer(size) and size > 0,
       do: {:ok, {:offset, page, size}}

  defp page_request(%Params.Cursor{first: first, after: after_cursor})
       when is_integer(first) and first > 0 and first <= 100 and
              (is_nil(after_cursor) or is_binary(after_cursor)),
       do: {:ok, {:cursor, first, after_cursor}}

  defp page_request(_), do: {:error, :invalid_mention_pagination}

  defp page_from_entries(entries, {:offset, page, size}),
    do: paginate(entries, %Params.Offset{page: page, size: size})

  defp page_from_entries(entries, {:cursor, first, after_cursor}),
    do: paginate(entries, %Params.Cursor{first: first, after: after_cursor})

  defp stream_page(query, community, {:offset, page, size}, direction) do
    start = (page - 1) * size

    {total, selected, _cache} =
      query
      |> Repo.stream(max_rows: 100)
      |> Enum.reduce({0, [], nil}, fn fact, {total, selected, cache} ->
        {entries, cache} = project_with_cache(fact, community, direction, cache)

        case entries do
          [entry] when total >= start and total < start + size ->
            {total + 1, [entry | selected], cache}

          [_entry] ->
            {total + 1, selected, cache}

          [] ->
            {total, selected, cache}
        end
      end)

    total_pages = if total == 0, do: 0, else: div(total + size - 1, size)

    {:ok,
     %Page.Offset{
       entries: Enum.reverse(selected),
       page: page,
       size: size,
       total_count: total,
       total_pages: total_pages,
       has_previous_page: page > 1,
       has_next_page: page < total_pages
     }}
  end

  defp stream_page(query, community, {:cursor, first, after_cursor}, direction) do
    found = is_nil(after_cursor)

    {found, selected, _cache} =
      query
      |> Repo.stream(max_rows: 100)
      |> Enum.reduce_while({found, [], nil}, fn fact, {found, selected, cache} ->
        {entries, cache} = project_with_cache(fact, community, direction, cache)

        case entries do
          [entry] when not found and entry.id == after_cursor ->
            {:cont, {true, selected, cache}}

          [entry] when found ->
            selected = [entry | selected]

            if length(selected) > first,
              do: {:halt, {true, selected, cache}},
              else: {:cont, {true, selected, cache}}

          _ ->
            {:cont, {found, selected, cache}}
        end
      end)

    if found do
      selected = Enum.reverse(selected)
      page_entries = Enum.take(selected, first)

      {:ok,
       %Page.Cursor{
         entries: page_entries,
         start_cursor: List.first(page_entries) && hd(page_entries).id,
         end_cursor: List.last(page_entries) && List.last(page_entries).id,
         has_previous_page: not is_nil(after_cursor),
         has_next_page: length(selected) > first
       }}
    else
      {:error, :invalid_mention_cursor}
    end
  end

  defp paginate(entries, nil), do: paginate(entries, %Params.Offset{page: 1, size: 20})

  defp paginate(entries, %Params.Offset{page: page, size: size})
       when is_integer(page) and page > 0 and is_integer(size) and size > 0 do
    total = length(entries)
    total_pages = if total == 0, do: 0, else: div(total + size - 1, size)

    {:ok,
     %Page.Offset{
       entries: Enum.slice(entries, (page - 1) * size, size),
       page: page,
       size: size,
       total_count: total,
       total_pages: total_pages,
       has_previous_page: page > 1,
       has_next_page: page < total_pages
     }}
  end

  defp paginate(entries, %Params.Cursor{first: first, after: after_cursor})
       when is_integer(first) and first > 0 and first <= 100 do
    start =
      case after_cursor do
        nil ->
          {:ok, 0}

        cursor when is_binary(cursor) ->
          case Enum.find_index(entries, &(&1.id == cursor)) do
            nil -> {:error, :invalid_mention_cursor}
            index -> {:ok, index + 1}
          end
      end

    with {:ok, index} <- start do
      page_entries = Enum.slice(entries, index, first)

      {:ok,
       %Page.Cursor{
         entries: page_entries,
         start_cursor: List.first(page_entries) && hd(page_entries).id,
         end_cursor: List.last(page_entries) && List.last(page_entries).id,
         has_previous_page: index > 0,
         has_next_page: index + first < length(entries)
       }}
    end
  end

  defp paginate(_entries, _), do: {:error, :invalid_mention_pagination}
end
