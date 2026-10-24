defmodule GroupherServer.CMS.Comments.Query do
  @moduledoc """
  List/paged operations and page projection support for Comments.

  Business position:

      Client
        -> GraphQL / Comments facade
        -> CMS.Comments
        -> Query
        -> Gate scope -> QueryBuilder / Pagi -> Repo -> PageProjection
        -> participant count drift -> best-effort reconciliation Job
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]
  alias GroupherServer.{Accounts, CMS, Jobs, Pagi, Repo}

  alias CMS.{
    Articles.Pagination,
    Comments.PageProjection,
    Comments.Replies,
    Comments.Query.Contract
  }

  alias CMS.{Dashboard.PagiMode, FrontDesk, QueryBuilder}
  alias Accounts.Model.User
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleStats,
    Comment,
    Community,
    PinnedComment,
    PostSolution
  }

  alias Helper.{ORM, T}
  alias Helper.ORM.Pagi.{Order, Page}
  alias Pagi.Params

  @pinned_comment_limit Comment.pinned_comment_limit()
  @doc """
  Returns the comment summary state for one article: total count, participant
  count, latest participants, and whether the viewer joined the conversation.

  ## Examples

      CMS.Comments.Query.comments_state(:post, article_id)

  """
  @spec comments_state(T.thread(), T.id()) :: T.domain_res(map())
  def comments_state(thread, article_id) do
    with {:ok, article} <- stable_article(thread, article_id),
         stats <- Repo.get_by(ArticleStats, thread: thread, article_id: article.id) do
      %{
        total_count: stats_value(stats, :comments_count),
        participants_count: stats_value(stats, :comments_participants_count),
        participants:
          participants_query(thread, article.id)
          |> order_by([user], desc: user.id)
          |> limit(20)
          |> Repo.all(),
        is_viewer_joined: false
      }
      |> done
    end
  end

  @doc """
  Returns one Article's Comment state with viewer participation.

  ## Examples

      Comments.Query.comments_state(:post, post_id, viewer)
  """
  @spec comments_state(T.thread(), T.id(), User.t()) :: T.domain_res(map())
  def comments_state(thread, article_id, %User{} = user) do
    with {:ok, article} <- stable_article(thread, article_id),
         thread_query <- article_comments(article.id),
         {:ok, state} <- comments_state(thread, article_id) do
      user_joined =
        case state.participants |> Enum.any?(&(&1.id == user.id)) do
          true ->
            true

          false ->
            from(c in Comment)
            |> CMS.Gate.scope(user, :read, comment_scope(thread))
            |> where(^thread_query)
            |> where([c], c.author_id == ^user.id)
            |> Repo.exists?()
        end

      state |> Map.merge(%{is_viewer_joined: user_joined}) |> done
    end
  end

  @doc """
  Returns the Comment page contract through the shared offset/cursor engine.

  ## Examples

      Query.page(:post, article_id, "community", %{sort: :desc_inserted}, nil, :timeline, viewer)
      #=> {:ok, %{entries: [], pinned_entries: [], page_info: page_info}}
  """
  @spec page(atom(), T.id(), String.t(), map(), term(), atom(), User.t() | nil) ::
          T.domain_res(map())
  def page(thread, article_id, community_slug, filter, pagi_input, mode, user \\ nil)

  def page(thread, article_id, community_slug, filter, pagi_input, mode, user)
      when is_atom(thread) and is_binary(community_slug) and is_map(filter) and
             mode in [:timeline, :replies] do
    with {:ok, :pass} <- Contract.validate_filter(filter),
         {:ok, effective} <-
           PagiMode.for_community(community_slug,
             expected_revision: Pagi.revision(pagi_input)
           ),
         {:ok, params} <- Pagi.from_input(pagi_input, effective.config.default_size),
         {:ok, article} <- stable_article(thread, article_id),
         query <- comment_page_query(article, thread, filter, mode, user),
         order <- comment_order(filter),
         {:ok, page} <-
           ORM.pagi(query, params,
             for: Comment,
             order: order,
             config: effective.config,
             resource: :comments,
             surface: "comments.#{thread}",
             mode: effective.mode,
             schema_version: effective.schema_version,
             query_fingerprint: comment_fingerprint(article.id, thread, filter, mode, order)
           ),
         {:ok, pinned_entries} <-
           comment_pinned_entries(article, thread, params, user),
         {:ok, hydrated} <-
           PageProjection.many(pinned_entries ++ page.entries, article, user, mode == :replies) do
      {:ok,
       %{
         entries: Enum.drop(hydrated, length(pinned_entries)),
         pinned_entries: Enum.take(hydrated, length(pinned_entries)),
         page_info: Page.info(page)
       }}
    end
  end

  def page(_thread, _article_id, _community_slug, _filter, _pagi_input, _mode, _user) do
    {:error, Pagi.invalid_config_context()}
  end

  @doc """
  Returns a Pagi page of all descendants under a canonical root, preserving direct parents.

  ## Examples

      Query.reply_page(root_comment, "community", %{sort: :asc_inserted}, nil, viewer)
      #=> {:ok, %{entries: [%Comment{}], page_info: page_info}}
  """
  def reply_page(comment, community_slug, filter, pagi_input, user \\ nil) do
    with {:ok, :pass} <- Contract.validate_filter(filter),
         {:ok, root} <- Replies.root(comment),
         {:ok, article} <- stable_article(root.thread, root.article_id),
         {:ok, effective} <-
           PagiMode.for_community(community_slug,
             expected_revision: Pagi.revision(pagi_input)
           ),
         {:ok, params} <- Pagi.from_input(pagi_input, effective.config.default_size),
         order <- comment_order(filter),
         {:ok, page} <-
           ORM.pagi(
             PageProjection.descendants(article.id, [root.id], root.thread, user),
             params,
             for: Comment,
             order: order,
             config: effective.config,
             resource: :comments,
             surface: "comment_replies.#{root.thread}",
             mode: effective.mode,
             schema_version: effective.schema_version,
             query_fingerprint:
               comment_fingerprint(
                 article.id,
                 root.thread,
                 filter,
                 {:descendants, root.id},
                 order
               )
           ),
         {:ok, entries} <- PageProjection.many(page.entries, article, user, false) do
      {:ok, %{entries: entries, page_info: Page.info(page)}}
    end
  end

  defp comment_page_query(article, thread, _filter, mode, user) do
    where_query =
      case mode do
        :timeline ->
          dynamic([comment], not comment.is_folded and not comment.is_pinned)

        :replies ->
          dynamic(
            [comment],
            is_nil(comment.reply_to_comment_id) and not comment.is_folded and
              not comment.is_pinned
          )
      end

    from(comment in Comment, as: :comment)
    |> preload([:body, :author])
    |> CMS.Gate.scope(user, :list, comment_scope(thread))
    |> where([comment], comment.article_id == ^article.id)
    |> where(^where_query)
    |> exclude_page_solution(thread, article.id)
  end

  defp comment_pinned_entries(article, thread, params, user) do
    if collection_start?(params) do
      page_pinned_comments(article, thread, user)
    else
      {:ok, []}
    end
  end

  defp page_pinned_comments(article, thread, user) do
    special_where =
      if thread == :post do
        dynamic(
          [comment, pin, solution],
          comment.article_id == ^article.id and
            (pin.article_id == ^article.id or solution.article_id == ^article.id)
        )
      else
        dynamic(
          [comment, pin, _solution],
          comment.article_id == ^article.id and pin.article_id == ^article.id
        )
      end

    Comment
    |> join(:left, [comment], pin in PinnedComment, on: pin.comment_id == comment.id)
    |> join(:left, [comment, _pin], solution in PostSolution,
      on: solution.comment_id == comment.id
    )
    |> where(^special_where)
    |> CMS.Gate.scope(user, :list, comment_scope(thread))
    |> order_by([comment, pin, solution],
      desc: fragment("? IS NOT NULL", solution.id),
      desc: pin.inserted_at,
      desc: comment.id
    )
    |> limit(^@pinned_comment_limit)
    |> preload([:body, :author])
    |> Repo.all()
    |> then(&{:ok, &1})
  end

  defp exclude_page_solution(query, :post, article_id) do
    where(
      query,
      [comment],
      not exists(
        from(solution in PostSolution,
          where:
            solution.article_id == ^article_id and solution.comment_id == parent_as(:comment).id
        )
      )
    )
  end

  defp exclude_page_solution(query, _thread, _article_id), do: query

  defp collection_start?(nil), do: true
  defp collection_start?(%Params.Offset{page: 1}), do: true
  defp collection_start?(%Params.Cursor{after: nil}), do: true
  defp collection_start?(_params), do: false

  defp comment_fingerprint(article_id, thread, filter, mode, order) do
    sort = if order.directions == [:desc, :desc], do: :desc_inserted, else: :asc_inserted
    filter = Map.put(filter, :sort, sort)

    :crypto.hash(
      :sha256,
      :erlang.term_to_binary({article_id, thread, filter, mode, Order.identity(order)})
    )
    |> Base.encode16(case: :lower)
  end

  @doc """
  Pages one user's publicly visible Comments, optionally restricted to a thread.

  ## Examples

      Query.paged_published_comments(author, :post, %{sort: :desc_inserted}, nil, viewer)
      #=> {:ok, %Page{entries: [%Comment{}]}}
  """
  @spec paged_published_comments(User.t(), atom() | nil, map(), Params.t() | nil, User.t() | nil) ::
          tuple()
  def paged_published_comments(%User{id: user_id}, thread, filter, pagi, actor) do
    with {:ok, :pass} <- Contract.validate_filter(filter),
         scope <- if(is_nil(thread), do: CommentContext.all_public(), else: comment_scope(thread)),
         order <- comment_order(filter),
         query <-
           Comment
           |> CMS.Gate.scope(actor, :list, scope)
           |> preload([:body, :author])
           |> where([comment], comment.author_id == ^user_id),
         query <- if(thread, do: where(query, [comment], comment.thread == ^thread), else: query),
         query <- restrict_to_visible_parent_bindings(query, actor, thread),
         query <- QueryBuilder.filter_pack(query, Map.delete(filter, :sort)),
         {:ok, paged} <-
           ORM.pagi(query, pagi,
             for: Comment,
             order: order,
             surface: "comments.published",
             query_fingerprint:
               comment_fingerprint(
                 user_id,
                 thread,
                 filter,
                 {:published, actor && actor.id},
                 order
               )
           ) do
      paged |> assign_stable_articles() |> done()
    end
  end

  defp restrict_to_visible_parent_bindings(query, actor, nil) do
    parent_filter =
      Enum.reduce([:post, :blog, :changelog, :doc], dynamic(false), fn thread, filter ->
        dynamic(
          [comment],
          ^filter or
            fragment(
              "?::text || ':' || ?::text IN (?)",
              comment.article_id,
              comment.community_id,
              subquery(visible_parent_bindings(actor, thread))
            )
        )
      end)

    where(query, ^parent_filter)
  end

  defp restrict_to_visible_parent_bindings(query, actor, thread) do
    where(
      query,
      [comment],
      fragment(
        "?::text || ':' || ?::text IN (?)",
        comment.article_id,
        comment.community_id,
        subquery(visible_parent_bindings(actor, thread))
      )
    )
  end

  defp visible_parent_bindings(actor, :doc) do
    Article
    |> CMS.Gate.scope(actor, :list, DocContext.public_main())
    |> select(
      [article, ...],
      fragment("?::text || ':' || ?::text", article.id, as(:gate_community).id)
    )
  end

  defp visible_parent_bindings(actor, thread) do
    Article
    |> CMS.Gate.scope(actor, :list, ArticleContext.public(thread))
    |> select(
      [article, ...],
      fragment("?::text || ':' || ?::text", article.id, as(:gate_community).id)
    )
  end

  defp assign_stable_articles(%{entries: entries} = page) do
    article_ids = Enum.map(entries, & &1.article_id)
    community_ids = Enum.map(entries, & &1.community_id)

    binding_by_identity =
      from(binding in ArticleBinding,
        join: community in Community,
        on: community.id == binding.community_id,
        where: binding.article_id in ^article_ids and binding.community_id in ^community_ids,
        select: {binding.article_id, binding.community_id, community.slug, binding.inner_id}
      )
      |> Repo.all()
      |> Map.new(fn {article_id, community_id, community, inner_id} ->
        {{article_id, community_id}, {community, inner_id}}
      end)

    paths =
      Enum.flat_map(entries, fn comment ->
        case Map.get(binding_by_identity, {comment.article_id, comment.community_id}) do
          {community, inner_id} ->
            [%{community: community, thread: comment.thread, inner_id: inner_id}]

          nil ->
            []
        end
      end)

    with {:ok, resolved} <- Pagination.lite_paths(paths) do
      articles_by_path =
        Map.new(resolved, fn article ->
          {{article.community.slug, article.thread, article.inner_id}, article}
        end)

      entries =
        Enum.flat_map(entries, fn comment ->
          case Map.get(binding_by_identity, {comment.article_id, comment.community_id}) do
            {community, inner_id} ->
              case Map.get(articles_by_path, {community, comment.thread, inner_id}) do
                nil -> []
                article -> [Map.put(comment, :article, article)]
              end

            nil ->
              []
          end
        end)

      Map.put(page, :entries, entries)
    end
  end

  @doc """
  Pages folded comments without inserting pins or solutions into the sequence.

  ## Examples

      Query.paged_folded_comments(:post, article_id, %{sort: :desc_inserted}, nil, viewer)
      #=> {:ok, %Page{entries: [%Comment{}]}}
  """
  def paged_folded_comments(thread, article_id, filter, pagi, viewer \\ nil) do
    with {:ok, :pass} <- Contract.validate_filter(filter),
         {:ok, article} <- stable_article(thread, article_id),
         order <- comment_order(filter),
         query <-
           Comment
           |> CMS.Gate.scope(viewer, :list, comment_scope(thread))
           |> where(
             [comment],
             comment.article_id == ^article.id and comment.is_folded and not comment.is_pinned
           )
           |> preload([:body, :author]),
         {:ok, page} <-
           ORM.pagi(query, pagi,
             for: Comment,
             order: order,
             surface: "comments.folded",
             query_fingerprint:
               comment_fingerprint(
                 article.id,
                 thread,
                 filter,
                 {:folded, viewer && viewer.id},
                 order
               )
           ),
         {:ok, entries} <- PageProjection.many(page.entries, article, viewer, false) do
      {:ok, %{page | entries: entries}}
    end
  end

  @doc """
  Pages distinct visible Comment authors; cursor reads do not execute a count.

  Offset reads may enqueue best-effort reconciliation when the stored participant
  count differs from the query result. Cursor reads never request a total count.

  ## Examples

      Query.paged_comments_participants(:post, article_id, nil)
      #=> {:ok, %Page{entries: [%User{}]}}
  """
  @spec paged_comments_participants(T.thread(), T.id(), Params.t() | nil) :: tuple()
  def paged_comments_participants(thread, article_id, pagi) do
    with {:ok, article} <- stable_article(thread, article_id),
         {:ok, page} <-
           ORM.pagi(participants_query(thread, article.id), pagi,
             for: User,
             order: %Order{fields: [:id], directions: [:desc], cursor_fields: [:id]},
             surface: "comments.participants",
             query_fingerprint: :erlang.term_to_binary({article.id, thread}) |> Base.encode64()
           ) do
      reconcile_participants_count(page, article)
      {:ok, page}
    end
  end

  defp reconcile_participants_count(%Page.Offset{total_count: count}, article) do
    stats = Repo.get_by(ArticleStats, thread: article.thread, article_id: article.id)

    if stats_value(stats, :comments_participants_count) != count do
      Jobs.enqueue_best_effort(:reconcile_comments_participants, article.id, fn ->
        Jobs.reconcile_comments_participants(article.thread, article.id, count)
      end)
    end

    {:ok, :pass}
  end

  defp reconcile_participants_count(%Page.Cursor{}, _article), do: {:ok, :pass}

  defp participants_query(thread, article_id) do
    authors =
      Comment
      |> where([comment], comment.article_id == ^article_id)
      |> CMS.Gate.scope(nil, :list, comment_scope(thread))
      |> select([comment], comment.author_id)
      |> distinct(true)

    from(author in User, where: author.id in subquery(authors))
  end

  defp comment_order(%{sort: :desc_inserted}) do
    %Order{
      fields: [:inserted_at, :id],
      directions: [:desc, :desc],
      cursor_fields: [:inserted_at, :id]
    }
  end

  defp comment_order(_filter) do
    %Order{
      fields: [:inserted_at, :id],
      directions: [:asc, :asc],
      cursor_fields: [:inserted_at, :id]
    }
  end

  defp comment_scope(:doc), do: CommentContext.for_thread(:doc, branch_policy: :main)
  defp comment_scope(thread), do: CommentContext.for_thread(thread)

  defp stable_article(thread, article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: ^thread} = article} -> {:ok, article}
      _ -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp article_comments(article_id), do: dynamic([comment], comment.article_id == ^article_id)

  defp stats_value(nil, _field), do: 0
  defp stats_value(stats, field), do: Map.fetch!(stats, field)

  @doc """
  Preloads the author of the parent Comment referenced by a reply.

  ## Examples

      Query.comment_with_reply_author(reply)
      #=> %Comment{reply_to_comment: %Comment{author: %User{}}}
  """
  @spec comment_with_reply_author(Comment.t()) :: Comment.t()
  def comment_with_reply_author(%Comment{} = comment) do
    Repo.preload(comment, reply_to_comment: :author)
  end
end
