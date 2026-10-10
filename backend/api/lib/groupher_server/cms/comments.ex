defmodule GroupherServer.CMS.Comments do
  @moduledoc """
  Public CMS boundary for Comment reads, aggregate commands, independent states
  and moderation.

  Business position:

      GraphQL resolver / internal caller
        -> CMS.Comments
             -> Store / Query          -> batched response projection
             -> Commands.<Action>      -> canonical aggregate transaction
             -> Writer / States / Moderation owners
  """

  alias __MODULE__.{
    CommandResult,
    InteractionResponse,
    Query,
    Moderation
  }

  alias __MODULE__.Query.Reconcile, as: Reconcile

  alias __MODULE__.Commands.{
    CreateComment,
    DeleteComment,
    Moderate,
    ReplyComment,
    StateChange,
    UpdateComment
  }

  alias __MODULE__.Solution
  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias Accounts.Profiles.ErrorCat, as: AuthErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.{Comment, Community}
  alias Helper.T

  @doc """
  Fetches one persisted Comment by id.

  ## Examples

      CMS.Comments.fetch_comment(comment_id)
  """
  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id), do: Reconcile.fetch_comment(comment_id)

  @doc """
  Fetches one Comment together with its full Article-facing information.

  ## Examples

      CMS.Comments.fetch_full_comment(comment_id)
  """
  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id), do: Reconcile.fetch_full_comment(comment_id)

  @doc """
  Returns one hydrated Comment without viewer-specific state.

  A CommentPath map is a public locator. An integer id is reserved for trusted
  internal callers and is loaded through the FrontDesk internal mode.

  ## Examples

      CMS.Comments.one_comment(comment_id)
  """
  @spec one_comment(T.id() | Comment.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{} = comment), do: InteractionResponse.one(comment, nil)

  def one_comment(%{article: _} = comment_path) do
    with {:ok, comment} <- FrontDesk.comment(comment_path) do
      InteractionResponse.one(comment, nil)
    end
  end

  def one_comment(comment_id) when is_integer(comment_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      InteractionResponse.one(comment, nil)
    end
  end

  @doc """
  Returns one Comment hydrated for the supplied viewer.

  ## Examples

      CMS.Comments.one_comment(comment_id, viewer)
  """
  @spec one_comment(T.id() | Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(%Comment{} = comment, %User{} = user) do
    InteractionResponse.one(comment, user)
  end

  def one_comment(%{article: _} = comment_path, %User{} = user) do
    with {:ok, comment} <- FrontDesk.comment(comment_path, user) do
      InteractionResponse.one(comment, user)
    end
  end

  def one_comment(comment_id, %User{} = user) when is_integer(comment_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      InteractionResponse.one(comment, user)
    end
  end

  @doc "Returns one bounded Article-scoped Comment reconciliation batch."
  @spec reconcile_comments(atom(), struct(), [integer() | String.t()], User.t() | nil) ::
          T.domain_res([Comment.t()])
  def reconcile_comments(thread, article, inner_ids, viewer) do
    Reconcile.reconcile_comments(thread, article, inner_ids, viewer)
  end

  @doc "Returns private Comment viewer state for one public Article path."
  @spec viewer_states(map(), [integer() | String.t()], User.t()) :: T.domain_res([map()])
  def viewer_states(article_path, inner_ids, %User{} = viewer) do
    Reconcile.viewer_states(article_path, inner_ids, viewer)
  end

  @doc "Returns an ordered Comment reconciliation read model."
  @spec reconcile_states(map(), [integer() | String.t()], User.t() | nil) :: T.domain_res(map())
  def reconcile_states(article_path, inner_ids, viewer) do
    Reconcile.reconcile_states(article_path, inner_ids, viewer)
  end

  @doc """
  Returns aggregate comment state for an Article without a viewer.

  ## Examples

      CMS.Comments.comments_state(:post, post_id)
  """
  @spec comments_state(T.thread(), T.id()) :: T.domain_res(map())
  def comments_state(thread, article_id), do: Query.comments_state(thread, article_id)

  @doc """
  Returns aggregate comment state including whether the viewer participated.

  ## Examples

      CMS.Comments.comments_state(:post, post_id, viewer)
  """
  @spec comments_state(T.thread(), T.id(), User.t()) :: T.domain_res(map())
  def comments_state(thread, article_id, %User{} = user) do
    Query.comments_state(thread, article_id, user)
  end

  @doc """
  Returns a page of Comments without viewer-specific state.

  ## Examples

      CMS.Comments.paged_comments(:post, post_id, filters, :replies)
  """
  @spec paged_comments(T.thread(), T.id(), map(), atom()) :: T.domain_res(T.paged_data())
  def paged_comments(thread, article_id, filters, mode) do
    paged_comments(thread, article_id, filters, mode, nil)
  end

  @doc """
  Returns a page of Comments hydrated for an optional viewer.

  ## Examples

      CMS.Comments.paged_comments(:post, post_id, filters, :replies, viewer)
  """
  @spec paged_comments(T.thread(), T.id(), map(), atom(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_comments(thread, article_id, filters, mode, user) do
    Query.paged_comments(thread, article_id, filters, mode, user)
  end

  @doc """
  Returns a user's published Comments across public Articles.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, filters)
  """
  @spec paged_published_comments(User.t(), map()) :: T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, filters) do
    Query.paged_published_comments(user, filters, nil)
  end

  @doc """
  Returns a user's published Comments with optional viewer state, or limits the
  result to one thread when the second argument is a thread atom.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, filters, viewer)
      CMS.Comments.paged_published_comments(target_user, :post, filters)
  """
  @spec paged_published_comments(User.t(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = target_user, filters, actor) when is_map(filters) do
    Query.paged_published_comments(target_user, filters, actor)
  end

  @spec paged_published_comments(User.t(), T.thread(), map()) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = user, thread, filters) when is_atom(thread) do
    Query.paged_published_comments(user, thread, filters, nil)
  end

  @doc """
  Returns one user's published Comments in a thread for an optional viewer.

  ## Examples

      CMS.Comments.paged_published_comments(target_user, :post, filters, viewer)
  """
  @spec paged_published_comments(User.t(), T.thread(), map(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_published_comments(%User{} = target_user, thread, filters, actor) do
    Query.paged_published_comments(target_user, thread, filters, actor)
  end

  @doc """
  Returns folded Comments without viewer-specific state.

  ## Examples

      CMS.Comments.paged_folded_comments(:post, post_id, filters)
  """
  @spec paged_folded_comments(T.thread(), T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters) do
    Query.paged_folded_comments(thread, article_id, filters)
  end

  @doc """
  Returns folded Comments hydrated for a viewer.

  ## Examples

      CMS.Comments.paged_folded_comments(:post, post_id, filters, viewer)
  """
  @spec paged_folded_comments(T.thread(), T.id(), map(), User.t()) ::
          T.domain_res(T.paged_data())
  def paged_folded_comments(thread, article_id, filters, %User{} = user) do
    Query.paged_folded_comments(thread, article_id, filters, user)
  end

  @doc """
  Returns replies under one Comment without viewer-specific state.

  ## Examples

      CMS.Comments.paged_comment_replies(comment_id, filters)
  """
  @spec paged_comment_replies(T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters) do
    Query.paged_comment_replies(comment_id, filters)
  end

  @doc """
  Returns replies under one Comment hydrated for an optional viewer.

  ## Examples

      CMS.Comments.paged_comment_replies(comment_id, filters, viewer)
  """
  @spec paged_comment_replies(T.id(), map(), User.t() | nil) :: T.domain_res(T.paged_data())
  def paged_comment_replies(comment_id, filters, user) do
    Query.paged_comment_replies(comment_id, filters, user)
  end

  @doc """
  Returns the distinct participants in an Article's Comments.

  ## Examples

      CMS.Comments.paged_comments_participants(:post, post_id, filters)
  """
  @spec paged_comments_participants(T.thread(), T.id(), map()) ::
          T.domain_res(T.paged_users())
  def paged_comments_participants(thread, article_id, filters) do
    Query.paged_comments_participants(thread, article_id, filters)
  end

  @doc """
  Creates a Comment from an already resolved Article and returns the Comment.

  ## Examples

      CMS.Comments.create_comment(:post, post, body, actor, command_id)
  """
  @spec create_comment(T.thread(), T.article(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def create_comment(_thread, _article, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec create_comment(T.thread(), T.article(), String.t(), User.t(), String.t()) ::
          T.domain_res(Comment.t())
  def create_comment(thread, article, body, %User{} = user, command_id) do
    with {:ok, %{comment: comment}} <-
           create_comment_payload(thread, article, body, user, command_id) do
      {:ok, comment}
    end
  end

  @doc """
  Resolves an Article from public identity, creates a Comment and returns it.

  ## Examples

      CMS.Comments.create_comment(community, :post, post_ref, body, actor, command_id)
  """
  @spec create_comment(Community.t(), T.thread(), T.id(), String.t(), User.t()) ::
          T.domain_res(Comment.t())
  def create_comment(%Community{}, _thread, _article_id, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec create_comment(Community.t(), T.thread(), T.id(), String.t(), User.t(), String.t()) ::
          T.domain_res(Comment.t())
  def create_comment(
        %Community{} = community,
        thread,
        article_id,
        body,
        %User{} = user,
        command_id
      ) do
    with {:ok, article} <-
           FrontDesk.article(
             %{community: community.slug, thread: thread, inner_id: article_id},
             user
           ),
         {:ok, %{comment: comment}} <-
           CreateComment.execute(thread, article, body, user, command_id) do
      {:ok, comment}
    end
  end

  @doc """
  Creates a Comment and returns the canonical Comment/Article payload.

  ## Examples

      CMS.Comments.create_comment_payload(:post, post, body, actor, command_id)
  """
  @spec create_comment_payload(T.thread(), T.article(), String.t(), User.t()) ::
          T.domain_res(map())
  def create_comment_payload(_thread, _article, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec create_comment_payload(T.thread(), T.article(), String.t(), User.t(), String.t()) ::
          T.domain_res(map())
  def create_comment_payload(thread, article, body, %User{} = user, command_id) do
    CreateComment.execute(thread, article, body, user, command_id)
  end

  @doc "Creates a Comment and returns its stable post-commit mutation result."
  @spec create_comment_result(T.thread(), T.article(), String.t(), User.t()) ::
          T.domain_res(map())
  def create_comment_result(_thread, _article, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec create_comment_result(T.thread(), T.article(), String.t(), User.t(), String.t()) ::
          T.domain_res(map())
  def create_comment_result(thread, article, body, %User{} = user, command_id) do
    CreateComment.execute(thread, article, body, user, command_id)
    |> CommandResult.build()
  end

  @doc """
  Rejects an unauthenticated Comment update.

  ## Examples

      CMS.Comments.update_comment(comment, body)
  """
  @spec update_comment(Comment.t(), String.t()) :: T.domain_res(Comment.t())
  def update_comment(%Comment{}, _body), do: {:error, AuthErrorCat.account_login()}

  @doc """
  Updates one authorized Comment in its canonical aggregate transaction.

  ## Examples

      CMS.Comments.update_comment(comment, body, actor)
  """
  @spec update_comment(Comment.t(), String.t(), User.t(), String.t() | nil) ::
          T.domain_res(UpdateComment.result())
  def update_comment(%Comment{}, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec update_comment(Comment.t(), String.t(), User.t(), String.t()) ::
          T.domain_res(UpdateComment.result())
  def update_comment(%Comment{} = comment, body, %User{} = user, command_id) do
    UpdateComment.execute(comment, body, user, command_id)
  end

  @doc "Updates a Comment and returns its stable post-commit mutation result."
  @spec update_comment_result(Comment.t(), String.t(), User.t()) :: T.domain_res(map())
  def update_comment_result(%Comment{}, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec update_comment_result(Comment.t(), String.t(), User.t(), String.t()) ::
          T.domain_res(map())
  def update_comment_result(%Comment{} = comment, body, %User{} = user, command_id) do
    comment
    |> UpdateComment.execute(body, user, command_id)
    |> CommandResult.build()
  end

  @doc """
  Rejects an unauthenticated Comment deletion.

  ## Examples

      CMS.Comments.delete_comment(comment)
  """
  @spec delete_comment(Comment.t()) :: T.domain_res(Comment.t())
  def delete_comment(%Comment{}), do: {:error, AuthErrorCat.account_login()}

  @doc """
  Soft-deletes one authorized Comment and reconciles its parent aggregate.

  ## Examples

      CMS.Comments.delete_comment(comment, actor)
  """
  @spec delete_comment(Comment.t(), User.t()) :: T.domain_res(DeleteComment.result())
  def delete_comment(%Comment{}, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec delete_comment(Comment.t(), User.t(), String.t()) ::
          T.domain_res(DeleteComment.result())
  def delete_comment(%Comment{} = comment, %User{} = user, command_id) do
    DeleteComment.execute(comment, user, command_id)
  end

  @doc "Deletes a Comment and returns its stable post-commit mutation result."
  @spec delete_comment_result(Comment.t(), User.t()) :: T.domain_res(map())
  def delete_comment_result(%Comment{}, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec delete_comment_result(Comment.t(), User.t(), String.t()) :: T.domain_res(map())
  def delete_comment_result(%Comment{} = comment, %User{} = user, command_id) do
    comment
    |> DeleteComment.execute(user, command_id)
    |> CommandResult.build()
  end

  @doc """
  Accepts or replaces the current solution of a QA Post.

  ## Examples

      CMS.Comments.accept_solution(comment, post_author)
  """
  @spec accept_solution(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def accept_solution(_comment_or_id, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec accept_solution(Comment.t() | T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Comment.t())
  def accept_solution(%Comment{} = comment, %User{} = user, command_id),
    do: Solution.accept(comment, user, command_id)

  def accept_solution(comment_id, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      Solution.accept(comment, user, command_id)
    end
  end

  @doc """
  Revokes a Comment when it is the current solution of its QA Post.

  ## Examples

      CMS.Comments.revoke_solution(comment, post_author)
  """
  @spec revoke_solution(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def revoke_solution(_comment_or_id, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec revoke_solution(Comment.t() | T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Comment.t())
  def revoke_solution(%Comment{} = comment, %User{} = user, command_id),
    do: Solution.revoke(comment, user, command_id)

  def revoke_solution(comment_id, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      Solution.revoke(comment, user, command_id)
    end
  end

  @doc """
  Creates a reply and returns the resulting Comment.

  ## Examples

      CMS.Comments.reply_comment(parent_comment, body, actor)
  """
  @spec reply_comment(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(Comment.t())
  def reply_comment(_comment_or_id, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec reply_comment(Comment.t() | T.id(), String.t(), User.t(), String.t()) ::
          T.domain_res(Comment.t())
  def reply_comment(comment_or_id, body, %User{} = user, command_id) do
    with {:ok, %{comment: comment}} <-
           reply_comment_payload(comment_or_id, body, user, command_id) do
      {:ok, comment}
    end
  end

  @doc """
  Creates a reply and returns the canonical Comment/Article payload.

  ## Examples

      CMS.Comments.reply_comment_payload(parent_id, body, actor, command_id)
  """
  @spec reply_comment_payload(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply_comment_payload(_comment_or_id, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec reply_comment_payload(Comment.t() | T.id(), String.t(), User.t(), String.t()) ::
          T.domain_res(map())

  def reply_comment_payload(%Comment{} = comment, body, %User{} = user, command_id) do
    ReplyComment.execute(comment, body, user, command_id)
  end

  def reply_comment_payload(comment_id, body, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      ReplyComment.execute(comment, body, user, command_id)
    end
  end

  @doc "Replies to a Comment and returns its stable post-commit mutation result."
  @spec reply_comment_result(Comment.t() | T.id(), String.t(), User.t()) :: T.domain_res(map())
  def reply_comment_result(_comment_or_id, _body, %User{}),
    do: {:error, CMS.ErrorCat.command_id_required()}

  @spec reply_comment_result(Comment.t() | T.id(), String.t(), User.t(), String.t()) ::
          T.domain_res(map())

  def reply_comment_result(%Comment{} = comment, body, %User{} = user, command_id) do
    comment
    |> ReplyComment.execute(body, user, command_id)
    |> CommandResult.build()
  end

  def reply_comment_result(comment_id, body, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      reply_comment_result(comment, body, user, command_id)
    end
  end

  @doc """
  Rejects an unauthenticated pin operation.

  ## Examples

      CMS.Comments.pin_comment(comment_id)
  """
  @spec pin_comment(T.id()) :: T.domain_res(Comment.t())
  def pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @doc """
  Pins one Comment independently of its solution state.

  ## Examples

      CMS.Comments.pin_comment(comment, actor)
  """
  @spec pin_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def pin_comment(_comment_or_id, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec pin_comment(Comment.t() | T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Comment.t())
  def pin_comment(%Comment{} = comment, %User{} = user, command_id),
    do: StateChange.execute(:pin, comment, user, command_id)

  def pin_comment(comment_id, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      pin_comment(comment, user, command_id)
    end
  end

  @doc """
  Rejects an unauthenticated unpin operation.

  ## Examples

      CMS.Comments.undo_pin_comment(comment_id)
  """
  @spec undo_pin_comment(T.id()) :: T.domain_res(Comment.t())
  def undo_pin_comment(_comment_id), do: {:error, AuthErrorCat.account_login()}

  @doc """
  Removes one Comment's independent pin binding.

  ## Examples

      CMS.Comments.undo_pin_comment(comment, actor)
  """
  @spec undo_pin_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def undo_pin_comment(_comment_or_id, %User{}), do: {:error, CMS.ErrorCat.command_id_required()}

  @spec undo_pin_comment(Comment.t() | T.id(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Comment.t())
  def undo_pin_comment(%Comment{} = comment, %User{} = user, command_id),
    do: StateChange.execute(:undo_pin, comment, user, command_id)

  def undo_pin_comment(comment_id, %User{} = user, command_id) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      undo_pin_comment(comment, user, command_id)
    end
  end

  @doc """
  Folds one Comment for an authorized actor.

  ## Examples

      CMS.Comments.fold_comment(comment, actor)
  """
  @spec fold_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def fold_comment(%Comment{} = comment, %User{} = user),
    do: StateChange.execute(:fold, comment, user)

  def fold_comment(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      fold_comment(comment, user)
    end
  end

  @doc """
  Restores one folded Comment for an authorized actor.

  ## Examples

      CMS.Comments.unfold_comment(comment, actor)
  """
  @spec unfold_comment(Comment.t() | T.id(), User.t()) :: T.domain_res(Comment.t())
  def unfold_comment(%Comment{} = comment, %User{} = user),
    do: StateChange.execute(:unfold, comment, user)

  def unfold_comment(comment_id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      unfold_comment(comment, user)
    end
  end

  @doc """
  Applies an illegal-content moderation state to a Comment.

  ## Examples

      CMS.Comments.set_comment_illegal(comment_id, attrs)
  """
  @spec set_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def set_comment_illegal(comment_id, attrs) do
    Moderate.execute(:set_illegal, comment_id, attrs)
  end

  @doc """
  Removes an illegal-content moderation state from a Comment.

  ## Examples

      CMS.Comments.unset_comment_illegal(comment_id, attrs)
  """
  @spec unset_comment_illegal(T.id(), map()) :: T.domain_res(Comment.t())
  def unset_comment_illegal(comment_id, attrs) do
    Moderate.execute(:unset_illegal, comment_id, attrs)
  end

  @doc """
  Returns Comments whose automated audit failed.

  ## Examples

      CMS.Comments.paged_audit_failed_comments(filters)
  """
  @spec paged_audit_failed_comments(map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed_comments(filter), do: Moderation.page_audit_failed(filter)

  @doc """
  Updates the automated audit-failure state of one Comment.

  ## Examples

      CMS.Comments.set_comment_audit_failed(comment, state)
  """
  @spec set_comment_audit_failed(Comment.t(), term()) :: T.domain_res(Comment.t())
  def set_comment_audit_failed(comment, state) do
    Moderate.execute(:set_audit_failed, comment, state)
  end
end
