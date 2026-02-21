defmodule GroupherServer.CMS.Comments do
  @moduledoc """
  CMS comments facade.
  """

  alias Helper.Types, as: T
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, Comment}

  alias __MODULE__.{
    Read,
    List,
    CRUD,
    Actions,
    Emotion,
    Moderation
  }

  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id), do: Read.fetch_comment(comment_id)

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id), do: Read.fetch_full_comment(comment_id)

  @spec one_comment(T.id()) :: T.domain_res(Comment.t())
  def one_comment(id), do: Read.one_comment(id)

  @spec one_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(id, %User{} = user), do: Read.one_comment(id, user)

  @spec comments_state(T.article_thread(), T.id()) :: T.domain_res(map())
  def comments_state(thread, article_id), do: List.comments_state(thread, article_id)

  @spec comments_state(T.article_thread(), T.id(), User.t()) :: T.domain_res(map())
  def comments_state(thread, article_id, %User{} = user), do: List.comments_state(thread, article_id, user)

  @spec paged_comments(T.article_thread(), T.id(), map(), atom(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comments(thread, article_id, filters, mode, user \\ nil), do: List.paged_comments(thread, article_id, filters, mode, user)

  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, filters), do: List.paged_published_comments(user, filters)

  @spec paged_published_comments(User.t(), T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filters), do: List.paged_published_comments(user, thread, filters)

  @spec paged_folded_comments(T.article_thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters), do: List.paged_folded_comments(thread, article_id, filters)

  @spec paged_folded_comments(T.article_thread(), T.id(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters, %User{} = user), do: List.paged_folded_comments(thread, article_id, filters, user)

  @spec paged_comment_replies(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters), do: List.paged_comment_replies(comment_id, filters)

  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters, user), do: List.paged_comment_replies(comment_id, filters, user)

  @spec paged_comments_participants(T.article_thread(), T.id(), map()) :: T.domain_res(T.paged_users())
  def paged_comments_participants(thread, article_id, filters), do: List.paged_comments_participants(thread, article_id, filters)

  @spec create_comment(Community.t(), T.article_thread(), T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def create_comment(%Community{} = community, thread, article_id, body, %User{} = user) do
    CRUD.create_comment(community, thread, article_id, body, user)
  end

  @spec update_comment(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def update_comment(%Comment{} = comment, body), do: CRUD.update_comment(comment, body)

  @spec delete_comment(Comment.t()) :: T.domain_res(Comment.t())
  def delete_comment(%Comment{} = comment), do: CRUD.delete_comment(comment)

  @spec mark_comment_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def mark_comment_solution(comment_id, %User{} = user), do: CRUD.mark_comment_solution(comment_id, user)

  @spec undo_mark_comment_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_mark_comment_solution(comment_id, %User{} = user), do: CRUD.undo_mark_comment_solution(comment_id, user)

  @spec upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def upvote_comment(comment_id, %User{} = user), do: Actions.upvote_comment(comment_id, user)

  @spec undo_upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_upvote_comment(comment_id, %User{} = user), do: Actions.undo_upvote_comment(comment_id, user)

  @spec reply_comment(T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def reply_comment(comment_id, body, %User{} = user), do: Actions.reply_comment(comment_id, body, user)

  @spec lock_article_comments(term()) :: T.domain_res(term())
  def lock_article_comments(article), do: Actions.lock_article_comments(article)

  @spec undo_lock_article_comments(term()) :: T.domain_res(term())
  def undo_lock_article_comments(article), do: Actions.undo_lock_article_comments(article)

  @spec pin_comment(T.id()) :: T.domain_res(Comment.t())
  def pin_comment(comment_id), do: Actions.pin_comment(comment_id)

  @spec undo_pin_comment(T.id()) :: T.domain_res(Comment.t())
  def undo_pin_comment(comment_id), do: Actions.undo_pin_comment(comment_id)

  @spec fold_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def fold_comment(comment_id, %User{} = user), do: Actions.fold_comment(comment_id, user)

  @spec unfold_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def unfold_comment(comment_id, %User{} = user), do: Actions.unfold_comment(comment_id, user)

  @spec emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def emotion_to_comment(comment_id, emotion, %User{} = user), do: Emotion.emotion_to_comment(comment_id, emotion, user)

  @spec undo_emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  def undo_emotion_to_comment(comment_id, emotion, %User{} = user), do: Emotion.undo_emotion_to_comment(comment_id, emotion, user)

  @spec set_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def set_comment_illegal(comment_id, attrs), do: Moderation.set_comment_illegal(comment_id, attrs)

  @spec unset_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def unset_comment_illegal(comment_id, attrs), do: Moderation.unset_comment_illegal(comment_id, attrs)

  @spec paged_audit_failed_comments(map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed_comments(filter), do: Moderation.paged_audit_failed_comments(filter)

  @spec set_comment_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  def set_comment_audit_failed(comment, state), do: Moderation.set_comment_audit_failed(comment, state)

  @spec update_user_in_comments_participants(User.t()) :: T.domain_res(term())
  def update_user_in_comments_participants(%User{} = user), do: CRUD.update_user_in_comments_participants(user)

  @spec archive_comments() :: T.domain_res(term())
  def archive_comments(), do: CRUD.archive_comments()
end
