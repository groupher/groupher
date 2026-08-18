defmodule GroupherServer.CMS.Comments do
  @moduledoc """
  Public CMS boundary for comment reads, writes, reactions, and moderation state.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Comments
        -> Repo / external boundary
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.{Comment, Community}
  alias Helper.T

  alias __MODULE__.{
    States,
    Writer,
    List,
    Moderation,
    Reader
  }

  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  @doc "Fetches comment through the `Comments` boundary."
  def fetch_comment(comment_id), do: Reader.fetch_comment(comment_id)

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  @doc "Fetches full comment through the `Comments` boundary."
  def fetch_full_comment(comment_id), do: Reader.fetch_full_comment(comment_id)

  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  @doc "Runs `one_comment` through the public `Comments` boundary."
  def one_comment(id), do: Reader.one_comment(id)

  @spec one_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(id, %User{} = user), do: Reader.one_comment(id, user)

  @spec comments_state(T.thread(), T.id()) :: T.domain_res(map())
  @doc "Runs `comments_state` through the public `Comments` boundary."
  def comments_state(thread, article_id), do: List.comments_state(thread, article_id)

  @spec comments_state(T.thread(), T.id(), User.t()) :: T.domain_res(map())
  def comments_state(thread, article_id, %User{} = user),
    do: List.comments_state(thread, article_id, user)

  @spec paged_comments(T.thread(), T.id(), map(), atom(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc "Returns paged comments from the `Comments` read boundary."
  def paged_comments(thread, article_id, filters, mode, user \\ nil),
    do: List.paged_comments(thread, article_id, filters, mode, user)

  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged published comments from the `Comments` read boundary."
  def paged_published_comments(%User{} = user, filters),
    do: List.paged_published_comments(user, filters, nil)

  def paged_published_comments(%User{} = target_user, filters, actor) when is_map(filters),
    do: List.paged_published_comments(target_user, filters, actor)

  @spec paged_published_comments(User.t(), T.thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filters) when is_atom(thread),
    do: List.paged_published_comments(user, thread, filters, nil)

  def paged_published_comments(%User{} = target_user, thread, filters, actor),
    do: List.paged_published_comments(target_user, thread, filters, actor)

  @spec paged_folded_comments(T.thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged folded comments from the `Comments` read boundary."
  def paged_folded_comments(thread, article_id, filters),
    do: List.paged_folded_comments(thread, article_id, filters)

  @spec paged_folded_comments(T.thread(), T.id(), map(), User.t()) ::
          T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters, %User{} = user),
    do: List.paged_folded_comments(thread, article_id, filters, user)

  @spec paged_comment_replies(T.id(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged comment replies from the `Comments` read boundary."
  def paged_comment_replies(comment_id, filters),
    do: List.paged_comment_replies(comment_id, filters)

  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters, user),
    do: List.paged_comment_replies(comment_id, filters, user)

  @spec paged_comments_participants(T.thread(), T.id(), map()) ::
          T.domain_res(T.paged_users())
  @doc "Returns paged comments participants from the `Comments` read boundary."
  def paged_comments_participants(thread, article_id, filters),
    do: List.paged_comments_participants(thread, article_id, filters)

  @spec create_comment(T.thread(), T.article(), String.t(), User.t()) :: T.domain_res(Comment.t())
  @doc "Creates comment through the `Comments` write boundary."
  def create_comment(thread, article, body, %User{} = user) do
    Writer.create(thread, article, body, user)
  end

  @spec create_comment(Community.t(), T.thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create_comment(%Community{} = community, thread, article_id, body, %User{} = user) do
    Writer.create(community, thread, article_id, body, user)
  end

  @spec update_comment(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  @doc "Updates comment through the `Comments` write boundary."
  def update_comment(%Comment{}, _body), do: {:error, AuthErrorCat.account_login()}

  @spec update_comment(Comment.t(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def update_comment(%Comment{} = comment, body, %User{} = user),
    do: Writer.update(comment, body, user)

  @spec delete_comment(Comment.t()) :: T.domain_res(Comment.t())
  @doc "Removes comment through the `Comments` boundary."
  def delete_comment(%Comment{}), do: {:error, AuthErrorCat.account_login()}

  @spec delete_comment(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def delete_comment(%Comment{} = comment, %User{} = user), do: Writer.delete(comment, user)

  @spec mark_comment_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `mark_comment_solution` through the public `Comments` boundary."
  def mark_comment_solution(comment_id, %User{} = user),
    do: Writer.mark_solution(comment_id, user)

  @spec undo_mark_comment_solution(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `undo_mark_comment_solution` through the public `Comments` boundary."
  def undo_mark_comment_solution(comment_id, %User{} = user),
    do: Writer.undo_mark_solution(comment_id, user)

  @spec upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `upvote_comment` through the public `Comments` boundary."
  def upvote_comment(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, canonical} <- CMS.Interactions.upvote(comment, user) do
      {:ok, CMS.Interactions.State.read(canonical, user)}
    end
  end

  @spec undo_upvote_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `undo_upvote_comment` through the public `Comments` boundary."
  def undo_upvote_comment(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         {:ok, canonical} <- CMS.Interactions.undo_upvote(comment, user) do
      {:ok, CMS.Interactions.State.read(canonical, user)}
    end
  end

  @spec reply_comment(T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `reply_comment` through the public `Comments` boundary."
  def reply_comment(comment_id, body, %User{} = user),
    do: Writer.reply(comment_id, body, user)

  @spec pin_comment(T.id()) :: T.domain_res(Comment.t())
  @doc "Runs `pin_comment` through the public `Comments` boundary."
  def pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec pin_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def pin_comment(comment_id, %User{} = user), do: States.pin(comment_id, user)

  @spec undo_pin_comment(T.id()) :: T.domain_res(Comment.t())
  @doc "Runs `undo_pin_comment` through the public `Comments` boundary."
  def undo_pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec undo_pin_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_pin_comment(comment_id, %User{} = user), do: States.undo_pin(comment_id, user)

  @spec fold_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `fold_comment` through the public `Comments` boundary."
  def fold_comment(comment_id, %User{} = user), do: States.fold(comment_id, user)

  @spec unfold_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `unfold_comment` through the public `Comments` boundary."
  def unfold_comment(comment_id, %User{} = user), do: States.unfold(comment_id, user)

  @spec emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `emotion_to_comment` through the public `Comments` boundary."
  def emotion_to_comment(comment_id, emotion, %User{} = user),
    do: interaction_emotion(comment_id, emotion, user, :add)

  @spec undo_emotion_to_comment(T.id(), atom(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `undo_emotion_to_comment` through the public `Comments` boundary."
  def undo_emotion_to_comment(comment_id, emotion, %User{} = user),
    do: interaction_emotion(comment_id, emotion, user, :remove)

  defp interaction_emotion(comment_id, emotion, user, operation) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id),
         result <-
           if(operation == :add,
             do: CMS.Interactions.emotion(comment, emotion, user),
             else: CMS.Interactions.undo_emotion(comment, emotion, user)
           ),
         {:ok, canonical} <- result do
      {:ok, CMS.Interactions.State.read(canonical, user)}
    end
  end

  @spec set_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  @doc "Runs `set_comment_illegal` through the public `Comments` boundary."
  def set_comment_illegal(comment_id, attrs),
    do: Moderation.set_illegal(comment_id, attrs)

  @spec unset_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  @doc "Runs `unset_comment_illegal` through the public `Comments` boundary."
  def unset_comment_illegal(comment_id, attrs),
    do: Moderation.unset_illegal(comment_id, attrs)

  @spec paged_audit_failed_comments(map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged audit failed comments from the `Comments` read boundary."
  def paged_audit_failed_comments(filter), do: Moderation.page_audit_failed(filter)

  @spec set_comment_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  @doc "Runs `set_comment_audit_failed` through the public `Comments` boundary."
  def set_comment_audit_failed(comment, state),
    do: Moderation.set_audit_failed(comment, state)

  @spec update_user_in_comments_participants(User.t()) :: T.domain_res(term())
  @doc "Updates user in comments participants through the `Comments` write boundary."
  def update_user_in_comments_participants(%User{} = user),
    do: Writer.update_user_in_comments_participants(user)

  @spec archive_comments() :: T.domain_res(term())
  @doc "Runs `archive_comments` through the public `Comments` boundary."
  def archive_comments, do: Writer.archive_comments()
end
