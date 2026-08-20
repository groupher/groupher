defmodule GroupherServer.CMS.Gate.Scope.Comment do
  @moduledoc """
  Builds complete public Comment visibility through its stable Community relation.

  Business position:

      Comment query
        -> Gate Scope
        -> public Comment boundary

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Comment.for_thread(:post)
      iex> %Ecto.Query{} = scope(Ecto.Queryable.to_query(GroupherServer.CMS.Model.Comment), nil, :read, context)
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{ArticleLifecycle, CommentLifecycle, DocBranch, DocLifecycle}
  alias CMS.Gate
  alias Gate.Scope.{ArticleSchema, CommunityChain}
  alias Gate.ErrorCat
  alias Gate.Scope.Policy

  alias Helper.Constant

  require CMS.Const

  @behaviour Policy

  @audit_illegal Constant.CMS.pending(:illegal)

  @actions [:read, :list]

  @doc "Builds thread-aware Comment visibility predicates into an Ecto query."
  @spec scope(Ecto.Query.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.Comment.t()) ::
          Ecto.Query.t() | {:error, GroupherServer.ErrorCat.Error.t()}
  @impl Policy
  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with :ok <- validate_thread(context),
         %Ecto.Query{} = query <- CommunityChain.direct(query) do
      query
      |> maybe_filter_thread(context)
      |> lifecycle_scope(context)
      |> public_comment(actor)
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, ErrorCat.unknown_action()}

  defp validate_thread(%{thread: :all}), do: :ok

  defp validate_thread(%{thread: :doc, branch_policy: :main}), do: :ok

  defp validate_thread(%{thread: :doc}), do: {:error, ErrorCat.scope_context_missing()}

  defp validate_thread(%{thread: thread}) do
    case ArticleSchema.fetch(thread) do
      {:ok, _schema} -> :ok
      {:error, _reason} -> {:error, ErrorCat.scope_context_missing()}
    end
  end

  defp validate_thread(_context), do: :ok

  defp maybe_filter_thread(query, %{thread: :all}), do: query

  defp maybe_filter_thread(query, %{thread: thread}),
    do: where(query, [comment], comment.thread == ^thread)

  defp maybe_filter_thread(query, _context), do: query

  defp lifecycle_scope(query, %{thread: :doc}) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      join: branch in DocBranch,
      as: :gate_doc_branch,
      on:
        branch.community_id == comment.community_id and
          branch.type == ^CMS.Const.doc_branch_type(:main),
      join: doc_lifecycle in DocLifecycle,
      as: :gate_doc_lifecycle,
      on:
        doc_lifecycle.community_id == comment.community_id and
          doc_lifecycle.branch_id == branch.id and
          doc_lifecycle.article_hash_id == comment.article_hash_id,
      where: lifecycle.state != :destroy,
      where: doc_lifecycle.state in [:published, :archived]
    )
  end

  defp lifecycle_scope(query, %{thread: :all}) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      left_join: article_lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on:
        article_lifecycle.community_id == comment.community_id and
          article_lifecycle.thread == comment.thread and
          article_lifecycle.article_hash_id == comment.article_hash_id and
          comment.thread != ^:doc,
      left_join: branch in DocBranch,
      as: :gate_doc_branch,
      on:
        branch.community_id == comment.community_id and
          branch.type == ^CMS.Const.doc_branch_type(:main) and comment.thread == ^:doc,
      left_join: doc_lifecycle in DocLifecycle,
      as: :gate_doc_lifecycle,
      on:
        doc_lifecycle.community_id == comment.community_id and
          doc_lifecycle.branch_id == branch.id and
          doc_lifecycle.article_hash_id == comment.article_hash_id and comment.thread == ^:doc,
      where: lifecycle.state != :destroy,
      where:
        (comment.thread != ^:doc and article_lifecycle.state in [:published, :archived]) or
          (comment.thread == ^:doc and doc_lifecycle.state in [:published, :archived])
    )
  end

  defp lifecycle_scope(query, _context) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      join: article_lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on:
        article_lifecycle.community_id == comment.community_id and
          article_lifecycle.thread == comment.thread and
          article_lifecycle.article_hash_id == comment.article_hash_id,
      where: lifecycle.state != :destroy,
      where: article_lifecycle.state in [:published, :archived]
    )
  end

  defp public_comment(query, %User{id: user_id}) do
    from(comment in query,
      where: comment.pending != ^@audit_illegal or comment.author_id == ^user_id
    )
  end

  defp public_comment(query, _actor) do
    from(comment in query,
      where: comment.pending != ^@audit_illegal
    )
  end
end
