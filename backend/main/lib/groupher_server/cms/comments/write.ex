defmodule GroupherServer.CMS.Comments.Write do
  @moduledoc """
  CRUD operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1, strip_struct: 1, get_config: 2]
  import Helper.ErrorCode

  import GroupherServer.CMS.Helper.Matcher

  alias GroupherServer.{Accounts, CMS, Repo}

  alias CMS.FrontDesk

  alias Accounts.Model.User
  alias CMS.Comments.States
  alias CMS.Events
  alias CMS.Helper.ArticleEnums
  alias CMS.Model.{Comment, Community, Embeds, PinnedComment, Post}

  alias Helper.{Multi, Later, ORM, T}

  @max_participator_count Comment.max_participator_count()
  @default_emotions Embeds.CommentEmotion.default_emotions()
  @delete_hint Comment.delete_hint()

  @default_comment_meta Embeds.CommentMeta.default_meta()

  @archive_threshold get_config(:article, :archive_threshold)

  @article_cat ArticleEnums.cat_values() |> Enum.into(%{}, &{&1, &1})
  @article_state ArticleEnums.state_values() |> Enum.into(%{}, &{&1, &1})

  @spec create(Community.t(), T.article_thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create(%Community{slug: community_slug}, thread, article_id, body, %User{} = user) do
    with {:ok, info} <- match(thread),
         {:ok, article} <-
           FrontDesk.article(community_slug, thread, article_id,
             preload: [[author: :user], :community]
           ),
         true <- can_comment?(article, user) do
      Multi.new()
      |> Multi.run(:create_comment, fn _, _ ->
        do_create_comment(body, info.foreign_key, article, user)
      end)
      |> Multi.run(:update_comments_count, fn _, %{create_comment: comment} ->
        {:ok, article} = FrontDesk.article_of(comment)
        ORM.inc(article, :comments_count)
      end)
      |> Multi.run(:set_question_flag_ifneed, fn _, %{create_comment: comment} ->
        set_question_flag_ifneed(article, comment)
      end)
      |> Multi.run(:add_participator, fn _, _ -> add_participant_to_article(article, user) end)
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
      {:error, error} -> {:error, error}
    end
  end

  defp can_comment?(article, _user) do
    not article.meta.is_comment_locked
  end

  @spec update(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def update(%{is_archived: true}, _body),
    do: raise_error(:archived, "comment is archived, can not be edit or delete")

  def update(%Comment{is_solution: true} = comment, body) do
    with {:ok, post} <- FrontDesk.get(Post, comment.post_id),
         {:ok, parsed} <- Helper.Converter.Article.parse_body(body),
         {:ok, digest} <- Helper.Converter.Article.parse_digest(parsed.body_map) do
      Multi.new()
      |> Multi.run(:update_parent_post, fn _, _ ->
        ORM.update(post, %{solution_digest: digest})
      end)
      |> Multi.run(:update_comment, fn _, _ ->
        %{body: body, body_html: body_html} = parsed
        comment |> ORM.update(%{body: body, body_html: body_html})
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
    with {:ok, %{body: body, body_html: body_html}} <- Helper.Converter.Article.parse_body(body) do
      Multi.new()
      |> Multi.run(:update_comment, fn _, _ ->
        ORM.update(comment, %{body: body, body_html: body_html})
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
    now = Timex.now() |> DateTime.truncate(:second)
    threshold = @archive_threshold[:default]
    archive_threshold = Timex.shift(now, threshold)

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

  defp do_create_comment(body, foreign_key, article, %User{id: user_id}) do
    with {:ok, %{body: body, body_html: body_html}} <- Helper.Converter.Article.parse_body(body) do
      thread = foreign_key |> to_string |> String.trim_trailing("_id") |> String.upcase()

      attrs = %{
        author_id: user_id,
        body: body,
        body_html: body_html,
        emotions: @default_emotions,
        floor: next_floor(article, foreign_key),
        is_article_author: user_id == article.author.user.id,
        thread: thread,
        meta: @default_comment_meta
      }

      Comment |> ORM.create(Map.put(attrs, foreign_key, article.id))
    end
  end

  defp add_participant_to_article(
         %{comments_participants: participants} = article,
         %User{} = user
       ) do
    cur_participants = participants |> List.insert_at(0, user) |> Enum.uniq_by(& &1.id)

    meta = article.meta |> strip_struct
    cur_participants_ids = (meta.comments_participant_user_ids ++ [user.id]) |> Enum.uniq()
    meta = Map.merge(meta, %{comments_participant_user_ids: cur_participants_ids})

    latest_participants = cur_participants |> Enum.slice(0, @max_participator_count)

    article
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_change(:comments_participants_count, cur_participants_ids |> length)
    |> Ecto.Changeset.put_embed(:comments_participants, latest_participants)
    |> Ecto.Changeset.put_embed(:meta, meta)
    |> Repo.update()
  end

  defp add_participant_to_article(_, _), do: {:ok, :pass}

  defp set_question_flag_ifneed(%Post{cat: cat}, %Comment{} = comment) do
    question_type = @article_cat.question

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

  defp next_floor(article, foreign_key) do
    {:ok, cur_count} =
      from(c in Comment, where: field(c, ^foreign_key) == ^article.id)
      |> ORM.count()

    cur_count + 1
  end

  defp update_post_state_for_solution(post, comment, is_solution) do
    case ORM.update(post, %{solution_digest: comment.body_html}) do
      {:ok, updated_post} ->
        state = if is_solution, do: @article_state.resolved, else: @article_state.default
        CMS.Articles.set_state(updated_post, state)

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
