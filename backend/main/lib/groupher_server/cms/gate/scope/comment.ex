defmodule GroupherServer.CMS.Gate.Scope.Comment do
  @moduledoc """
  Compiles complete public Comment visibility through its stable Community relation.

  Business position:

      Comment query
        -> Gate Scope
        -> public Comment boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Gate.Scope.{AncestorCommunity, ArticleSchema}
  alias GroupherServer.CMS.Model.{ArticleLifecycle, CommentLifecycle}
  alias Helper.Constant

  @audit_illegal Constant.CMS.pending(:illegal)

  @actions [:read, :list]

  @spec scope(Ecto.Query.t(), term(), atom(), map()) :: Ecto.Query.t() | {:error, atom()}
  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with :ok <- validate_thread(context),
         %Ecto.Query{} = query <- AncestorCommunity.direct(query) do
      query
      |> maybe_filter_thread(context)
      |> lifecycle_scope()
      |> public_comment(actor)
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, :unknown_action}

  defp validate_thread(%{thread: thread}) do
    case ArticleSchema.fetch(thread) do
      {:ok, _schema} -> :ok
      {:error, _reason} -> {:error, :scope_context_missing}
    end
  end

  defp validate_thread(_context), do: :ok

  defp maybe_filter_thread(query, %{thread: thread}),
    do: where(query, [comment], comment.thread == ^thread)

  defp maybe_filter_thread(query, _context), do: query

  defp lifecycle_scope(query) do
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
