defmodule GroupherServer.CMS.Comments.List do
  @moduledoc """
  List/paged operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1]
  import ShortMaps

  import GroupherServer.CMS.Helper.Matcher

  alias Helper.Types, as: T
  alias Helper.{Later, ORM, QueryBuilder}
  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.FrontDesk

  alias Accounts.Model.User
  alias CMS.Model.{Comment, PinnedComment}

  @pinned_comment_limit Comment.pinned_comment_limit()

  @spec comments_state(T.article_thread(), T.id()) :: T.domain_res(map())
  def comments_state(thread, article_id) do
    filter = %{page: 1, size: 20}

    with {:ok, thread_query} <- match(thread, :query, article_id),
         {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, article_id),
         {:ok, paged_participants} <- do_paged_comments_participants(thread_query, filter) do
      %{
        total_count: article.comments_count,
        participants_count: article.comments_participants_count,
        participants: paged_participants.entries,
        is_viewer_joined: false
      }
      |> done
    end
  end

  @spec comments_state(T.article_thread(), T.id(), User.t()) :: T.domain_res(map())
  def comments_state(thread, article_id, %User{} = user) do
    with {:ok, thread_query} <- match(thread, :query, article_id),
         {:ok, state} <- comments_state(thread, article_id) do
      user_joined =
        case state.participants |> Enum.any?(&(&1.id == user.id)) do
          true ->
            true

          false ->
            from(c in Comment)
            |> where(^thread_query)
            |> where([c], c.author_id == ^user.id)
            |> Repo.all()
            |> length
            |> Kernel.>(0)
        end

      state |> Map.merge(%{is_viewer_joined: user_joined}) |> done
    end
  end

  @spec paged_comments(T.article_thread(), T.id(), map(), atom(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comments(thread, article_id, filters, mode, user \\ nil)

  def paged_comments(thread, article_id, filters, :timeline, user) do
    where_query = dynamic([c], not c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  def paged_comments(thread, article_id, filters, :replies, user) do
    where_query =
      dynamic(
        [c],
        is_nil(c.reply_to_id) and not c.is_folded and not c.is_pinned
      )

    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  def paged_comments(_thread, _article_id, _filters, mode, _user) do
    {:error, "unknown mode: #{mode}"}
  end

  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{id: user_id}, filter) do
    %{page: page, size: size} = filter

    Comment
    |> join(:inner, [comment], author in assoc(comment, :author))
    |> where([comment, author], author.id == ^user_id)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> ORM.extract_and_assign_article()
    |> done()
  end

  @spec paged_published_comments(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{id: user_id}, thread, filter) do
    %{page: page, size: size} = filter

    thread = thread |> to_string |> String.upcase()
    thread_atom = thread |> String.downcase() |> String.to_atom()

    article_preload = Keyword.new([{thread_atom, [author: :user]}])
    query = from(comment in Comment, preload: ^article_preload)

    query
    |> join(:inner, [comment], author in assoc(comment, :author))
    |> where([comment, author], comment.thread == ^thread)
    |> where([comment, author], author.id == ^user_id)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> ORM.extract_and_assign_article()
    |> done()
  end

  @spec paged_folded_comments(T.article_thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters) do
    where_query = dynamic([c], c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, nil)
  end

  @spec paged_folded_comments(T.article_thread(), T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters, %User{} = user) do
    where_query = dynamic([c], c.is_folded and not c.is_pinned)
    do_paged_comment(thread, article_id, filters, where_query, user)
  end

  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters, user \\ nil)

  def paged_comment_replies(comment_id, filters, user) do
    do_paged_comment_replies(comment_id, filters, user)
  end

  @spec paged_comments_participants(T.article_thread(), T.id(), map()) :: T.domain_res(T.paged_users())
  def paged_comments_participants(thread, article_id, filters) do
    with {:ok, thread_query} <- match(thread, :query, article_id),
         {:ok, info} <- match(thread),
         {:ok, article} <- FrontDesk.get(info.model, article_id),
         {:ok, paged_data} <- do_paged_comments_participants(thread_query, filters) do
      if article.comments_participants_count !== paged_data.total_count do
        Later.run({ORM, :update, [article, %{comments_participants_count: paged_data.total_count}]})
      end

      paged_data |> done
    end
  end

  defp do_paged_comments_participants(query, filters) do
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
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  defp do_paged_comment(thread, article_id, filters, where_query, user) do
    %{page: page, size: size} = filters
    sort = Map.get(filters, :sort, :asc_inserted)

    with {:ok, thread_query} <- match(thread, :query, article_id) do
      query = from(c in Comment, preload: [reply_to: :author])

      query
      |> where(^thread_query)
      |> where(^where_query)
      |> QueryBuilder.filter_pack(Map.merge(filters, %{sort: sort}))
      |> ORM.paginator(~m(page size)a)
      |> add_pinned_comments_ifneed(thread, article_id, filters)
      |> FrontDesk.mark_viewer_emotion_states(user)
      |> mark_viewer_has_upvoted(user)
      |> done()
    end
  end

  defp do_paged_comment_replies(comment_id, filters, user) do
    %{page: page, size: size} = filters
    sort = Map.get(filters, :sort, :asc_inserted)
    query = from(c in Comment, preload: [reply_to: :author])

    where_query = dynamic([c], not c.is_folded and c.reply_to_id == ^comment_id)

    query
    |> where(^where_query)
    |> QueryBuilder.filter_pack(Map.merge(filters, %{sort: sort}))
    |> ORM.paginator(~m(page size)a)
    |> FrontDesk.mark_viewer_emotion_states(user)
    |> mark_viewer_has_upvoted(user)
    |> done()
  end

  defp add_pinned_comments_ifneed(paged_comments, thread, article_id, %{page: 1}) do
    with {:ok, info} <- match(thread),
         {:ok, pinned_comments} <- list_pinned_comments(info, article_id) do
      case pinned_comments do
        [] ->
          paged_comments

        _ ->
          pinned_comments =
            sort_solution_to_front(thread, pinned_comments)
            |> Enum.slice(0, @pinned_comment_limit)
            |> Repo.preload(reply_to: :author)

          entries = pinned_comments ++ paged_comments.entries
          pinned_comment_count = length(pinned_comments)

          total_count = paged_comments.total_count + pinned_comment_count
          paged_comments |> Map.merge(%{entries: entries, total_count: total_count})
      end
    end
  end

  defp add_pinned_comments_ifneed(paged_comments, _thread, _article_id, _), do: paged_comments

  defp list_pinned_comments(%{foreign_key: foreign_key}, article_id) do
    from(p in PinnedComment,
      join: c in Comment,
      on: p.comment_id == c.id,
      where: field(p, ^foreign_key) == ^article_id,
      order_by: [desc: p.inserted_at],
      select: c
    )
    |> Repo.all()
    |> done
  end

  defp sort_solution_to_front(:post, pinned_comments) do
    solution_index = Enum.find_index(pinned_comments, & &1.is_solution)

    case is_nil(solution_index) do
      true ->
        pinned_comments

      false ->
        {solution_comment, rest_comments} = List.pop_at(pinned_comments, solution_index)
        [solution_comment] ++ rest_comments
    end
  end

  defp sort_solution_to_front(_, pinned_comments), do: pinned_comments

  defp mark_viewer_has_upvoted(paged_comments, nil), do: paged_comments

  defp mark_viewer_has_upvoted(%{entries: entries} = paged_comments, %User{} = user) do
    entries =
      Enum.map(
        entries,
        fn comment ->
          replies =
            Enum.map(comment.replies, fn reply_comment ->
              Map.merge(reply_comment, %{
                viewer_has_upvoted: Enum.member?(reply_comment.meta.upvoted_user_ids, user.id)
              })
            end)

          Map.merge(comment, %{
            viewer_has_upvoted: Enum.member?(comment.meta.upvoted_user_ids, user.id),
            replies: replies
          })
        end
      )

    Map.merge(paged_comments, %{entries: entries})
  end
end
