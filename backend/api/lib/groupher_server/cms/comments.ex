defmodule GroupherServer.CMS.Comments do
  @moduledoc """
  Public CMS boundary for Comment reads, aggregate commands, independent states
  and moderation.

  Business position:

      GraphQL resolver / internal caller
        -> CMS.Comments
             -> Reader / List          -> batched response projection
             -> Commands.<Action>      -> canonical aggregate transaction
             -> Writer create/reply    -> canonical aggregate transaction
             -> States / Moderation    -> focused domain operation
  """
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias GroupherServer.CMS.FrontDesk
  alias GroupherServer.CMS.Model.{Comment, Community}
  alias Helper.T

  alias __MODULE__.{
    List,
    Moderation,
    Reader,
    States,
    Writer
  }

  alias __MODULE__.Commands.{DeleteComment, Solution, UpdateComment}

  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  @doc """
  Fetches one persisted Comment by id.

  ## Examples

      CMS.Comments.fetch_comment(comment_id)
  """
  def fetch_comment(comment_id), do: Reader.fetch_comment(comment_id)

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  @doc """
  Fetches one Comment together with its full Article-facing information.

  ## Examples

      CMS.Comments.fetch_full_comment(comment_id)
  """
  def fetch_full_comment(comment_id), do: Reader.fetch_full_comment(comment_id)

  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  @doc """
  Returns one hydrated Comment without viewer-specific state.

  ## Examples

      CMS.Comments.one_comment(comment_id)
  """
  def one_comment(id), do: Reader.one_comment(id)

  @spec one_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Returns one Comment hydrated for the supplied viewer.

  ## Examples

      CMS.Comments.one_comment(comment_id, viewer)
  """
  def one_comment(id, %User{} = user), do: Reader.one_comment(id, user)

  @spec reconcile_comments(atom(), struct(), [integer() | String.t()], User.t() | nil) ::
          T.domain_res([Comment.t()])
  @doc "Returns one bounded Article-scoped Comment reconciliation batch."
  def reconcile_comments(thread, article, inner_ids, viewer),
    do: Reader.reconcile_comments(thread, article, inner_ids, viewer)

  @spec comments_state(T.thread(), T.id()) :: T.domain_res(map())
  @doc """
  Returns aggregate comment state for an Article without a viewer.

  ## Examples

      CMS.Comments.comments_state(:post, post_id)
  """
  def comments_state(thread, article_id), do: List.comments_state(thread, article_id)

  @spec comments_state(T.thread(), T.id(), User.t()) :: T.domain_res(map())
  @doc """
  Returns aggregate comment state including whether the viewer participated.

  ## Examples

      CMS.Comments.comments_state(:post, post_id, viewer)
  """
  def comments_state(thread, article_id, %User{} = user),
    do: List.comments_state(thread, article_id, user)

  @spec paged_comments(T.thread(), T.id(), map(), atom()) :: T.domain_res(T.paged_data())
  @doc """
  Returns a page of Comments without viewer-specific state.

  ## Examples

      CMS.Comments.paged_comments(:post, post_id, filters, :replies)
  """
  def paged_comments(thread, article_id, filters, mode),
    do: paged_comments(thread, article_id, filters, mode, nil)

  @spec paged_comments(T.thread(), T.id(), map(), atom(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns a page of Comments hydrated for an optional viewer.

  ## Examples

      CMS.Comments.paged_comments(:post, post_id, filters, :replies, viewer)
  """
  def paged_comments(thread, article_id, filters, mode, user),
    do: List.paged_comments(thread, article_id, filters, mode, user)

  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns a user's published Comments across public Articles.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, filters)
  """
  def paged_published_comments(%User{} = user, filters),
    do: List.paged_published_comments(user, filters, nil)

  @spec paged_published_comments(User.t(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns a user's published Comments with optional viewer state, or limits the
  result to one thread when the second argument is a thread atom.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, filters, viewer)
      CMS.Comments.paged_published_comments(target_user, :post, filters)
  """
  def paged_published_comments(%User{} = target_user, filters, actor) when is_map(filters),
    do: List.paged_published_comments(target_user, filters, actor)

  @spec paged_published_comments(User.t(), T.thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filters) when is_atom(thread),
    do: List.paged_published_comments(user, thread, filters, nil)

  @spec paged_published_comments(User.t(), T.thread(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns one user's published Comments in a thread for an optional viewer.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, :post, filters, viewer)
  """
  def paged_published_comments(%User{} = target_user, thread, filters, actor),
    do: List.paged_published_comments(target_user, thread, filters, actor)

  @spec paged_folded_comments(T.thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns folded Comments without viewer-specific state.

  ## Examples

      CMS.Comments.paged_folded_comments(:post, post_id, filters)
  """
  def paged_folded_comments(thread, article_id, filters),
    do: List.paged_folded_comments(thread, article_id, filters)

  @spec paged_folded_comments(T.thread(), T.id(), map(), User.t()) ::
          T.domain_res(T.paged_data())
  @doc """
  Returns folded Comments hydrated for a viewer.

  ## Examples

      CMS.Comments.paged_folded_comments(:post, post_id, filters, viewer)
  """
  def paged_folded_comments(thread, article_id, filters, %User{} = user),
    do: List.paged_folded_comments(thread, article_id, filters, user)

  @spec paged_comment_replies(T.id(), map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns replies under one Comment without viewer-specific state.

  ## Examples

      CMS.Comments.paged_comment_replies(comment_id, filters)
  """
  def paged_comment_replies(comment_id, filters),
    do: List.paged_comment_replies(comment_id, filters)

  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  @doc """
  Returns replies under one Comment hydrated for an optional viewer.

  ## Examples

      CMS.Comments.paged_comment_replies(comment_id, filters, viewer)
  """
  def paged_comment_replies(comment_id, filters, user),
    do: List.paged_comment_replies(comment_id, filters, user)

  @spec paged_comments_participants(T.thread(), T.id(), map()) ::
          T.domain_res(T.paged_users())
  @doc """
  Returns the distinct participants in an Article's Comments.

  ## Examples

      CMS.Comments.paged_comments_participants(:post, post_id, filters)
  """
  def paged_comments_participants(thread, article_id, filters),
    do: List.paged_comments_participants(thread, article_id, filters)

  @spec create_comment(T.thread(), T.article(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  @doc """
  Creates a Comment from an already resolved Article and returns the Comment.

  ## Examples

      CMS.Comments.create_comment(:post, post, body, actor)
  """
  def create_comment(thread, article, body, %User{} = user),
    do: create_comment(thread, article, body, user, nil)

  @spec create_comment(T.thread(), T.article(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(Comment.t())
  def create_comment(thread, article, body, %User{} = user, command_key) do
    with {:ok, %{comment: comment}} <-
           create_comment_payload(thread, article, body, user, command_key) do
      {:ok, comment}
    end
  end

  @doc """
  Resolves an Article from public identity, creates a Comment and returns it.

  ## Examples

      CMS.Comments.create_comment(community, :post, post_ref, body, actor)
  """
  @spec create_comment(Community.t(), T.thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create_comment(%Community{} = community, thread, article_id, body, %User{} = user),
    do: create_comment(community, thread, article_id, body, user, nil)

  @spec create_comment(Community.t(), T.thread(), T.id(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(Comment.t())
  def create_comment(
        %Community{} = community,
        thread,
        article_id,
        body,
        %User{} = user,
        command_key
      ) do
    with {:ok, article} <-
           FrontDesk.article(community, thread, article_id,
             preload: [[author: :user], :community]
           ),
         {:ok, %{comment: comment}} <-
           Writer.create(thread, article, body, user, command_key) do
      {:ok, comment}
    end
  end

  @spec create_comment_payload(T.thread(), T.article(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(map())
  @doc """
  Creates a Comment and returns the canonical Comment/Article payload.

  ## Examples

      CMS.Comments.create_comment_payload(:post, post, body, actor)
  """
  def create_comment_payload(thread, article, body, %User{} = user, command_key \\ nil),
    do: Writer.create(thread, article, body, user, command_key)

  @spec update_comment(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  @doc """
  Rejects an unauthenticated Comment update.

  ## Examples

      CMS.Comments.update_comment(comment, body)
  """
  def update_comment(%Comment{}, _body), do: {:error, AuthErrorCat.account_login()}

  @spec update_comment(Comment.t(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(Comment.t())
  @doc """
  Updates one authorized Comment in its canonical aggregate transaction.

  ## Examples

      CMS.Comments.update_comment(comment, body, actor)
  """
  def update_comment(%Comment{} = comment, body, %User{} = user),
    do: update_comment(comment, body, user, nil)

  @spec update_comment(Comment.t(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(Comment.t())
  def update_comment(%Comment{} = comment, body, %User{} = user, command_key),
    do: UpdateComment.execute(comment, body, user, command_key)

  @spec delete_comment(Comment.t()) :: T.domain_res(Comment.t())
  @doc """
  Rejects an unauthenticated Comment deletion.

  ## Examples

      CMS.Comments.delete_comment(comment)
  """
  def delete_comment(%Comment{}), do: {:error, AuthErrorCat.account_login()}

  @spec delete_comment(Comment.t(), User.t(), String.t() | nil) :: T.domain_res(Comment.t())
  @doc """
  Soft-deletes one authorized Comment and reconciles its parent aggregate.

  ## Examples

      CMS.Comments.delete_comment(comment, actor)
  """
  def delete_comment(%Comment{} = comment, %User{} = user),
    do: delete_comment(comment, user, nil)

  @spec delete_comment(Comment.t(), User.t(), String.t() | nil) :: T.domain_res(Comment.t())
  def delete_comment(%Comment{} = comment, %User{} = user, command_key),
    do: DeleteComment.execute(comment, user, command_key)

  @doc """
  Accepts or replaces the current solution of a QA Post.

  ## Examples

      CMS.Comments.accept_solution(comment, post_author)
  """
  @spec accept_solution(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def accept_solution(%Comment{} = comment, %User{} = user), do: Solution.accept(comment, user)

  def accept_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      Solution.accept(comment, user)
    end
  end

  @doc """
  Revokes a Comment when it is the current solution of its QA Post.

  ## Examples

      CMS.Comments.revoke_solution(comment, post_author)
  """
  @spec revoke_solution(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def revoke_solution(%Comment{} = comment, %User{} = user), do: Solution.revoke(comment, user)

  def revoke_solution(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      Solution.revoke(comment, user)
    end
  end

  @spec reply_comment(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Creates a reply and returns the resulting Comment.

  ## Examples

      CMS.Comments.reply_comment(parent_comment, body, actor)
  """
  def reply_comment(comment_or_id, body, %User{} = user),
    do: reply_comment(comment_or_id, body, user, nil)

  @spec reply_comment(Comment.t() | T.id(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(Comment.t())
  def reply_comment(comment_or_id, body, %User{} = user, command_key) do
    with {:ok, %{comment: comment}} <-
           reply_comment_payload(comment_or_id, body, user, command_key) do
      {:ok, comment}
    end
  end

  @spec reply_comment_payload(Comment.t() | T.id(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(map())
  @doc """
  Creates a reply and returns the canonical Comment/Article payload.

  ## Examples

      CMS.Comments.reply_comment_payload(parent_id, body, actor)
  """
  def reply_comment_payload(comment_or_id, body, user, command_key \\ nil)

  def reply_comment_payload(%Comment{} = comment, body, %User{} = user, command_key),
    do: Writer.reply(comment, body, user, command_key)

  def reply_comment_payload(comment_id, body, %User{} = user, command_key) do
    with {:ok, comment} <- FrontDesk.get(Comment, comment_id) do
      Writer.reply(comment, body, user, command_key)
    end
  end

  @spec pin_comment(T.id()) :: T.domain_res(Comment.t())
  @doc """
  Rejects an unauthenticated pin operation.

  ## Examples

      CMS.Comments.pin_comment(comment_id)
  """
  def pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec pin_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Pins one Comment independently of its solution state.

  ## Examples

      CMS.Comments.pin_comment(comment, actor)
  """
  def pin_comment(%Comment{} = comment, %User{} = user), do: States.pin(comment, user)
  def pin_comment(comment_id, %User{} = user), do: States.pin(comment_id, user)

  @spec undo_pin_comment(T.id()) :: T.domain_res(Comment.t())
  @doc """
  Rejects an unauthenticated unpin operation.

  ## Examples

      CMS.Comments.undo_pin_comment(comment_id)
  """
  def undo_pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @spec undo_pin_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Removes one Comment's independent pin relation.

  ## Examples

      CMS.Comments.undo_pin_comment(comment, actor)
  """
  def undo_pin_comment(%Comment{} = comment, %User{} = user), do: States.undo_pin(comment, user)
  def undo_pin_comment(comment_id, %User{} = user), do: States.undo_pin(comment_id, user)

  @spec fold_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Folds one Comment for an authorized actor.

  ## Examples

      CMS.Comments.fold_comment(comment, actor)
  """
  def fold_comment(%Comment{} = comment, %User{} = user), do: States.fold(comment, user)
  def fold_comment(comment_id, %User{} = user), do: States.fold(comment_id, user)

  @spec unfold_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  @doc """
  Restores one folded Comment for an authorized actor.

  ## Examples

      CMS.Comments.unfold_comment(comment, actor)
  """
  def unfold_comment(%Comment{} = comment, %User{} = user), do: States.unfold(comment, user)
  def unfold_comment(comment_id, %User{} = user), do: States.unfold(comment_id, user)

  @spec set_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  @doc """
  Applies an illegal-content moderation state to a Comment.

  ## Examples

      CMS.Comments.set_comment_illegal(comment_id, attrs)
  """
  def set_comment_illegal(comment_id, attrs),
    do: Moderation.set_illegal(comment_id, attrs)

  @spec unset_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  @doc """
  Removes an illegal-content moderation state from a Comment.

  ## Examples

      CMS.Comments.unset_comment_illegal(comment_id, attrs)
  """
  def unset_comment_illegal(comment_id, attrs),
    do: Moderation.unset_illegal(comment_id, attrs)

  @spec paged_audit_failed_comments(map()) :: T.domain_res(T.paged_data())
  @doc """
  Returns Comments whose automated audit failed.

  ## Examples

      CMS.Comments.paged_audit_failed_comments(filters)
  """
  def paged_audit_failed_comments(filter), do: Moderation.page_audit_failed(filter)

  @spec set_comment_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  @doc """
  Updates the automated audit-failure state of one Comment.

  ## Examples

      CMS.Comments.set_comment_audit_failed(comment, state)
  """
  def set_comment_audit_failed(comment, state),
    do: Moderation.set_audit_failed(comment, state)
end
