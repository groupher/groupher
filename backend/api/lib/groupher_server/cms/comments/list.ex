defmodule GroupherServer.CMS.Comments.List do
  alias GroupherServer.CMS.QueryBuilder

  @moduledoc """
  List/paged operations for comments.

  Business position:

      Client
        -> GraphQL
        -> CMS.Comments
        -> List
        -> Repo / domain event
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Jobs, Repo}
  alias GroupherServer.CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias GroupherServer.CMS.Gate.Context.Scope.Comment, as: CommentScope
  alias GroupherServer.CMS.Gate.Context.Scope.Doc, as: DocScope

  alias GroupherServer.CMS.Comments.InteractionResponse
  alias GroupherServer.CMS.Comments.Replies
  alias GroupherServer.CMS.Model.{Comment, PinnedComment}
  alias Helper.{ORM, T}

  @pinned_comment_limit Comment.pinned_comment_limit()
  @published_article_preloads [
    post: [author: :user],
    blog: [author: :user],
    changelog: [author: :user],
    doc: [author: :user]
  ]

  @doc """
  Returns the comment summary state for one article: total count, participant
  count, latest participants, and whether the viewer joined the conversation.

  ## Examples

      CMS.Comments.List.comments_state(:post, article_id)

  """
  @spec comments_state(T.thread(), T.id()) :: T.domain_res(map())
  def comments_state(thread, article_id) do
    filter = %{page: 1, size: 20}

    with {:ok, thread_query} <- match(thread, :query, article_id),
         {:ok, info} <- match(thread),
         {:ok, article} <- public_article(info.model, thread, article_id),
         {:ok, paged_participants} <-
           do_paged_comments_participants(thread, thread_query, filter) do
      %{
        total_count: article.comments_count,
        participants_count: article.comments_participants_count,
        participants: paged_participants.entries,
        is_viewer_joined: false
      }
      |> done
    end
  end

  @spec comments_state(T.thread(), T.id(), User.t()) :: T.domain_res(map())
  @doc """
  Returns one Article's Comment state with viewer participation.

  ## Examples

      Comments.List.comments_state(:post, post_id, viewer)
  """
  def comments_state(thread, article_id, %User{} = user) do
    with {:ok, thread_query} <- match(thread, :query, article_id),
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

  @spec paged_comments(T.thread(), T.id(), map(), atom()) :: T.domain_res(T.paged_data())
  @doc """
  Returns a page of Comments without viewer state.

  ## Examples

      Comments.List.paged_comments(:post, post_id, filters, :replies)
  """
  def paged_comments(thread, article_id, filters, mode),
    do: paged_comments(thread, article_id, filters, mode, nil)

  @spec paged_comments(T.thread(), T.id(), map(), atom(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns a page of Comments hydrated for an optional viewer.

  The `:timeline` mode includes flat visible Comments; `:replies` returns root
  Comments with their embedded reply projection.

  ## Examples

      Comments.List.paged_comments(:post, post_id, filters, :replies, viewer)
  """

  def paged_comments(thread, article_id, filters, :timeline, user) do
    where_query = dynamic([c], not c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  def paged_comments(thread, article_id, filters, :replies, user) do
    where_query =
      dynamic(
        [c],
        is_nil(c.reply_to_comment_id) and not c.is_folded and not c.is_pinned
      )

    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  def paged_comments(_thread, _article_id, _filters, mode, _user) do
    {:error, "unknown mode: #{mode}"}
  end

  @spec paged_published_comments(User.t(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns a user's published Comments across all public Article threads.

  ## Examples

      Comments.List.paged_published_comments(target_user, filters, viewer)
  """
  def paged_published_comments(%User{id: user_id}, filter, actor) do
    %{page: page, size: size} = filter

    Comment
    |> preload(^@published_article_preloads)
    |> CMS.Gate.scope(actor, :list, CommentScope.all_public())
    |> join(:inner, [comment, ...], author in assoc(comment, :author),
      as: :published_comment_author
    )
    |> where([_comment, ...], as(:published_comment_author).id == ^user_id)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> ORM.extract_and_assign_article()
    |> done()
  end

  @spec paged_published_comments(User.t(), T.thread(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns a user's published Comments in one Article thread.

  ## Examples

      Comments.List.paged_published_comments(target_user, :post, filters, viewer)
  """
  def paged_published_comments(%User{id: user_id}, thread, filter, actor) do
    %{page: page, size: size} = filter

    article_preload = Keyword.new([{thread, [author: :user]}])
    query = from(comment in Comment, preload: ^article_preload)

    query
    |> CMS.Gate.scope(actor, :list, comment_scope(thread))
    |> join(:inner, [comment, ...], author in assoc(comment, :author),
      as: :published_comment_author
    )
    |> where([comment, ...], comment.thread == ^thread)
    |> where([_comment, ...], as(:published_comment_author).id == ^user_id)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> ORM.extract_and_assign_article()
    |> done()
  end

  @spec paged_folded_comments(T.thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns folded Comments without viewer state.

  ## Examples

      Comments.List.paged_folded_comments(:post, post_id, filters)
  """
  def paged_folded_comments(thread, article_id, filters) do
    where_query = dynamic([c], c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, nil)
  end

  @spec paged_folded_comments(T.thread(), T.id(), map(), User.t()) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns folded Comments hydrated for a viewer.

  ## Examples

      Comments.List.paged_folded_comments(:post, post_id, filters, viewer)
  """
  def paged_folded_comments(thread, article_id, filters, %User{} = user) do
    where_query = dynamic([c], c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  @spec paged_comment_replies(T.id(), map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns replies under one root Comment without viewer state.

  ## Examples

      Comments.List.paged_comment_replies(comment_id, filters)
  """
  def paged_comment_replies(comment_id, filters),
    do: paged_comment_replies(comment_id, filters, nil)

  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  @doc """
  Returns replies under one root Comment hydrated for an optional viewer.

  ## Examples

      Comments.List.paged_comment_replies(comment_id, filters, viewer)
  """
  def paged_comment_replies(comment_id, filters, user) do
    do_paged_comment_replies(comment_id, filters, user)
  end

  @spec paged_comments_participants(T.thread(), T.id(), map()) ::
          T.domain_res(T.paged_users())
  @doc """
  Returns distinct Comment participants and schedules a best-effort projection
  repair when the persisted count differs.

  ## Examples

      Comments.List.paged_comments_participants(:post, post_id, filters)
  """
  def paged_comments_participants(thread, article_id, filters) do
    with {:ok, thread_query} <- match(thread, :query, article_id),
         {:ok, info} <- match(thread),
         {:ok, article} <- public_article(info.model, thread, article_id),
         {:ok, paged_data} <-
           do_paged_comments_participants(thread, thread_query, filters) do
      case article.comments_participants_count !== paged_data.total_count do
        true ->
          :ok =
            Jobs.enqueue_best_effort(:reconcile_comments_participants, article.id, fn ->
              Jobs.reconcile_comments_participants(article, paged_data.total_count)
            end)

          done(paged_data)

        false ->
          done(paged_data)
      end
    end
  end

  defp do_paged_comments_participants(thread, query, filters) do
    %{page: page, size: size} = filters

    Comment
    |> where(^query)
    |> QueryBuilder.filter_pack(Map.merge(filters, %{sort: :desc_inserted}))
    |> join(:inner, [c], a in assoc(c, :author))
    |> distinct([c, a], a.id)
    |> group_by([c, a], a.id)
    |> group_by([c, a], c.inserted_at)
    |> group_by([c, a], c.id)
    |> select([c, a], a)
    |> CMS.Gate.scope(nil, :list, comment_scope(thread))
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  defp public_article(schema, thread, article_id) do
    context = article_scope(thread)

    schema
    |> CMS.Gate.scope(nil, :read, context)
    |> where([article], article.id == ^article_id)
    |> Repo.one()
    |> done()
  end

  defp do_paged_comment(thread, article_id, filters, where_query, user) do
    %{page: page, size: size} = filters
    sort = Map.get(filters, :sort, :asc_inserted)

    with {:ok, thread_query} <- match(thread, :query, article_id) do
      article_author_id = article_author_id(thread, article_id)
      query = from(c in Comment, preload: [reply_to_comment: :author])

      query
      |> CMS.Gate.scope(user, :list, comment_scope(thread))
      |> where(^thread_query)
      |> where(^where_query)
      |> prioritize_solution(thread)
      |> QueryBuilder.filter_pack(Map.merge(filters, %{sort: sort}))
      |> ORM.paginator(~m(page size)a)
      |> add_pinned_comments_ifneed(thread, article_id, filters)
      |> then(fn paged ->
        case InteractionResponse.many(paged.entries, user, article_author_id: article_author_id) do
          {:ok, entries} ->
            Map.put(paged, :entries, prioritize_hydrated_solution(entries, thread))

          {:error, _reason} = error ->
            error
        end
      end)
      |> done()
    end
  end

  defp prioritize_solution(query, :post) do
    query
    |> join(:left, [comment, ...], solution in GroupherServer.CMS.Model.PostSolution,
      on: solution.comment_id == comment.id,
      as: :post_solution
    )
    |> prepend_order_by([_comment, ...], desc: not is_nil(as(:post_solution).id))
  end

  defp prioritize_solution(query, _thread), do: query

  defp prioritize_hydrated_solution(entries, :post) do
    case Enum.split_with(entries, & &1.is_solution) do
      {[], _rest} -> entries
      {solutions, rest} -> solutions ++ rest
    end
  end

  defp prioritize_hydrated_solution(entries, _thread), do: entries

  defp do_paged_comment_replies(comment_id, filters, user) do
    %{page: page, size: size} = filters
    sort = Map.get(filters, :sort, :asc_inserted)

    with {:ok, root_comment} <- Replies.root(comment_id) do
      query = from(c in Comment, preload: [reply_to_comment: :author])
      root_comment_id = root_comment.id

      where_query =
        dynamic(
          [c],
          not c.is_folded and
            (c.root_comment_id == ^root_comment_id or
               (is_nil(c.root_comment_id) and c.reply_to_comment_id == ^root_comment_id))
        )

      query
      |> CMS.Gate.scope(user, :list, comment_scope(root_comment.thread))
      |> where(^where_query)
      |> QueryBuilder.filter_pack(Map.merge(filters, %{sort: sort}))
      |> ORM.paginator(~m(page size)a)
      |> then(fn paged ->
        case InteractionResponse.many(paged.entries, user,
               article_author_id: article_author_id(root_comment)
             ) do
          {:ok, entries} -> Map.put(paged, :entries, entries)
          {:error, _reason} = error -> error
        end
      end)
      |> done()
    end
  end

  defp add_pinned_comments_ifneed(paged_comments, thread, article_id, %{page: 1}) do
    with {:ok, info} <- match(thread),
         {:ok, pinned_comments} <- list_pinned_comments(info, thread, article_id) do
      case pinned_comments do
        [] ->
          paged_comments

        _ ->
          pinned_comments =
            pinned_comments
            |> Enum.slice(0, @pinned_comment_limit)
            |> Repo.preload(reply_to_comment: :author)

          entries = pinned_comments ++ paged_comments.entries
          pinned_comment_count = length(pinned_comments)

          total_count = paged_comments.total_count + pinned_comment_count
          paged_comments |> Map.merge(%{entries: entries, total_count: total_count})
      end
    end
  end

  defp add_pinned_comments_ifneed(paged_comments, _thread, _article_id, _), do: paged_comments

  defp article_author_id(thread, article_id) do
    case match(thread) do
      {:ok, %{model: model}} ->
        from(article in model,
          join: author in assoc(article, :author),
          where: article.id == ^article_id,
          select: author.user_id
        )
        |> Repo.one()

      _ ->
        nil
    end
  end

  defp article_author_id(comment) do
    with {:ok, article} <- CMS.FrontDesk.article_of(comment),
         {:ok, author} <- CMS.FrontDesk.author_of(article) do
      author.id
    else
      _ -> nil
    end
  end

  defp comment_scope(:doc), do: CommentScope.for_thread(:doc, branch_policy: :main)
  defp comment_scope(thread), do: CommentScope.for_thread(thread)

  defp article_scope(:doc), do: DocScope.public_main()
  defp article_scope(thread), do: ArticleScope.public(thread)

  defp list_pinned_comments(%{foreign_key: foreign_key}, thread, article_id) do
    from(c in Comment,
      join: p in PinnedComment,
      on: p.comment_id == c.id,
      where: field(p, ^foreign_key) == ^article_id,
      order_by: [desc: p.inserted_at, desc: p.id],
      select: c
    )
    |> CMS.Gate.scope(nil, :list, comment_scope(thread))
    |> Repo.all()
    |> done
  end
end
