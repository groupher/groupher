defmodule GroupherServer.CMS.Comments.Write do
  @moduledoc """
  CRUD operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1, get_config: 2]
  import Helper.ErrorCode

  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Repo}

  alias CMS.FrontDesk

  alias Accounts.Model.User
  alias CMS.Comments.States
  alias CMS.Comments.Helper, as: CommentHelper
  alias CMS.Events
  alias CMS.Helper.ArticleEnums
  alias CMS.Model.{Comment, Community, PinnedComment, Post}

  alias Helper.{ContentPipeline, Datetime, Multi, Later, ORM, T}

  @delete_hint Comment.delete_hint()

  @archive_threshold get_config(:article, :archive_threshold)

  @article_cat ArticleEnums.cat_values() |> Enum.into(%{}, &{&1, &1})
  @article_status ArticleEnums.status_values() |> Enum.into(%{}, &{&1, &1})

  @spec create(Community.t(), T.article_thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create(%Community{slug: community_slug}, thread, article_id, body, %User{} = user) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           FrontDesk.article(community_slug, thread, article_id,
             preload: [[author: :user], :community]
           ),
         true <- CommentHelper.can_comment?(article, user) do
      Multi.new()
      |> Multi.run(:create_comment, fn _, _ ->
        CommentHelper.do_create_comment(body, info.foreign_key, article, user)
      end)
      |> Multi.run(:update_comments_count, fn _, %{create_comment: comment} ->
        {:ok, article} = FrontDesk.article_of(comment)
        ORM.inc(article, :comments_count)
      end)
      |> Multi.run(:set_question_flag_ifneed, fn _, %{create_comment: comment} ->
        set_question_flag_ifneed(article, comment)
      end)
      |> Multi.run(:add_participator, fn _, _ ->
        CommentHelper.add_participant_to_article(article, user)
      end)
      |> Multi.run(:update_article_active_timestamp, fn _, %{create_comment: comment} ->
        case comment.author_id == article.author.user.id do
          true -> {:ok, :pass}
          false -> CMS.Articles.update_active_timestamp(thread, article)
        end
      end)
      |> Multi.run(:after_events, fn _, %{create_comment: comment} ->
        Later.run({Events, :emit, [:cite, %{artiment: comment}]})
        Later.run({Events, :emit, [:notify_comment, %{comment: comment, from_user: user}]})
        Later.run({Events, :emit, [:mention, %{artiment: comment}]})
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})

        Later.run(
          {Events, :emit, [:subscribe_community, %{target: article.community, user: user}]}
        )
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> raise_error(:article_comments_locked, "this article is forbid comment")
    end
  end

  @spec update(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def update(%{is_archived: true}, _body),
    do: raise_error(:archived, "comment is archived, can not be edit or delete")

  def update(%Comment{is_solution: true} = comment, body) do
    with {:ok, post} <- FrontDesk.get(Post, comment.post_id),
         {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      Multi.new()
      |> Multi.run(:update_parent_post, fn _, _ ->
        ORM.update(post, %{solution_digest: payload.digest})
      end)
      |> Multi.run(:update_comment, fn _, _ ->
        comment |> ORM.update(%{body: payload.json, body_html: payload.html})
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{update_comment: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, %{update_comment: comment} ->
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def update(%Comment{} = comment, body) do
    with {:ok, payload} <- ContentPipeline.parse(%{body: body}) do
      Multi.new()
      |> Multi.run(:update_comment, fn _, _ ->
        ORM.update(comment, %{body: payload.json, body_html: payload.html})
      end)
      |> Multi.run(:sync_embed_replies, fn _, %{update_comment: comment} ->
        FrontDesk.sync_embed_replies(comment)
      end)
      |> Multi.run(:after_events, fn _, %{update_comment: comment} ->
        Later.run({Events, :emit, [:audition, %{artiment: comment}]})
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec delete(Comment.t()) :: T.domain_res(Comment.t())
  def delete(%{is_archived: true}),
    do: raise_error(:archived, "article is archived, can not be edit or delete")

  def delete(%Comment{} = comment) do
    Multi.new()
    |> Multi.run(:update_comments_count, fn _, _ ->
      {:ok, article} = FrontDesk.article_of(comment)
      ORM.dec(article, :comments_count)
    end)
    |> Multi.run(:remove_pined_comment, fn _, _ ->
      ORM.findby_delete(PinnedComment, %{comment_id: comment.id})
    end)
    |> Multi.run(:delete_comment, fn _, _ ->
      ORM.update(comment, %{body_html: @delete_hint, is_deleted: true})
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec mark_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def mark_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, post} <- FrontDesk.get(Post, comment.post_id, preload: [author: :user]) do
      do_mark_comment_solution(post, comment, user, true)
    end
  end

  @spec undo_mark_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_mark_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, post} <- FrontDesk.get(Post, comment.post_id, preload: [author: :user]) do
      do_mark_comment_solution(post, comment, user, false)
    end
  end

  defp do_mark_comment_solution(post, %Comment{} = comment, %User{} = user, is_solution) do
    case user.id == post.author.user.id do
      true ->
        batch_update_solution_flag(post, false)

        Multi.new()
        |> Multi.run(:pin_comment, fn _, _ ->
          if is_solution do
            States.pin(comment.id)
          else
            States.undo_pin(comment.id)
          end
        end)
        |> Multi.run(:mark_solution, fn _, %{pin_comment: updated_comment} ->
          ORM.update(updated_comment, %{is_solution: is_solution, is_for_question: true})
        end)
        |> Multi.run(:update_post_state, fn _, _ ->
          update_post_state_for_solution(post, comment, is_solution)
        end)
        |> Multi.run(:sync_embed_replies, fn _, %{mark_solution: updated_comment} ->
          FrontDesk.sync_embed_replies(updated_comment)
        end)
        |> Repo.transaction()
        |> result()

      false ->
        raise_error(:require_questioner, "oops, questioner only")
    end
  end

  @spec update_user_in_comments_participants(User.t()) :: T.domain_res(term())
  def update_user_in_comments_participants(%User{login: login}) do
    from(a in CMS.Model.Post,
      cross_join: cp in fragment("jsonb_array_elements(?)", a.comments_participants),
      where: fragment("?->>'login' = ?", cp, ^login)
    )
    |> Repo.all()
    |> done()
  end

  @spec archive_comments() :: T.domain_res(term())
  def archive_comments do
    now = Datetime.now(:second)
    threshold = @archive_threshold[:default]
    archive_threshold = Datetime.shift(now, threshold)

    Comment
    |> where([c], c.inserted_at < ^archive_threshold)
    |> Repo.update_all(set: [is_archived: true, archived_at: now])
    |> done()
  end

  @spec batch_update_question_flag(Post.t(), boolean()) :: T.domain_res(term())
  def batch_update_question_flag(%Post{} = post, is_question) do
    from(c in Comment, where: c.post_id == ^post.id)
    |> Repo.update_all(set: [is_for_question: is_question])
    |> done()
  end

  defp set_question_flag_ifneed(%Post{cat: cat}, %Comment{} = comment) do
    question_type = @article_cat.qa

    case cat do
      ^question_type ->
        ORM.update(comment, %{is_for_question: true})

      _ ->
        ORM.update(comment, %{is_for_question: false})
    end
  end

  defp set_question_flag_ifneed(_, comment), do: {:ok, comment}

  defp batch_update_solution_flag(%Post{} = post, is_question) do
    from(c in Comment,
      where: c.post_id == ^post.id,
      update: [set: [is_solution: ^is_question]]
    )
    |> Repo.update_all([])

    {:ok, :pass}
  end

  defp update_post_state_for_solution(post, comment, is_solution) do
    solution_digest =
      if is_solution do
        case ContentPipeline.parse(%{body: comment.body}) do
          {:ok, payload} -> payload.digest
          _ -> comment.body_html
        end
      else
        nil
      end

    case ORM.update(post, %{solution_digest: solution_digest}) do
      {:ok, updated_post} ->
        status = if is_solution, do: @article_status.resolved, else: @article_status.default
        CMS.Articles.set_status(updated_post, status)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp result({:ok, %{set_question_flag_ifneed: result}}), do: {:ok, result}
  defp result({:ok, %{delete_comment: result}}), do: {:ok, result}
  defp result({:ok, %{mark_solution: result}}), do: {:ok, result}
  defp result({:ok, %{sync_embed_replies: result}}), do: {:ok, result}

  defp result({:error, :create_comment, result, _steps}) do
    raise_error(:create_comment, result)
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
