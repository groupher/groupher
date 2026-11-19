defmodule GroupherServer.CMS.Gate.Scope.Comment do
  @moduledoc """
  Builds complete public Comment visibility through its stable Community binding.

  Business position:

      Comment query
        -> Gate Scope
        -> public Comment boundary

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Comment.for_thread(:post, community_id: community.id)
      iex> %Ecto.Query{} = scope(Ecto.Queryable.to_query(GroupherServer.CMS.Model.Comment), nil, :read, context)
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Gate.{ErrorCat, Scope.Policy}
  alias CMS.Gate.Scope.{ArticleSchema, CommunityChain}

  alias CMS.Model.{
    ArticleLifecycle,
    CommentLifecycle,
    CommentReviewBlock
  }

  @behaviour Policy

  @actions [:read, :list]

  @doc "Builds thread-aware Comment visibility predicates into an Ecto query."
  @spec scope(Ecto.Query.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.Comment.t()) ::
          Ecto.Query.t() | {:error, ErrorCat.error()}
  @impl Policy
  def scope(%Ecto.Query{} = query, actor, :read, %{policy_mode: :mentioned_target} = context) do
    with {:ok, _} <- validate_thread(context),
         %Ecto.Query{} = query <- CommunityChain.comment_parent(query) do
      from(comment in query,
        join: lifecycle in CommentLifecycle,
        as: :gate_comment_lifecycle,
        on: lifecycle.comment_id == comment.id,
        where: lifecycle.state == :visible
      )
      |> maybe_filter_thread(context)
      |> filter_community(context)
      |> public_parent(actor, context)
      |> public_comment(actor)
    end
  end

  def scope(%Ecto.Query{} = query, actor, action, context) when action in @actions do
    with {:ok, _} <- validate_thread(context),
         %Ecto.Query{} = query <- CommunityChain.comment_parent(query) do
      query
      |> maybe_filter_thread(context)
      |> filter_community(context)
      |> lifecycle_scope(context)
      |> public_parent(actor, context)
      |> public_comment(actor)
    end
  end

  def scope(_query, _actor, _action, _context), do: {:error, ErrorCat.unknown_action()}

  defp validate_thread(%{thread: :all}), do: {:ok, :pass}

  defp validate_thread(%{thread: :doc, community_id: id}) when is_integer(id), do: {:ok, :pass}

  defp validate_thread(%{thread: :doc}), do: {:error, ErrorCat.scope_context_missing()}

  defp validate_thread(%{thread: thread, community_id: community_id})
       when is_integer(community_id) do
    case ArticleSchema.fetch(thread) do
      {:ok, _schema} -> {:ok, :pass}
      {:error, _reason} -> {:error, ErrorCat.scope_context_missing()}
    end
  end

  defp validate_thread(_context), do: {:error, ErrorCat.scope_context_missing()}

  defp filter_community(query, %{community_id: id}) when is_integer(id) do
    where(query, [gate_community: community], community.id == ^id)
  end

  defp filter_community(query, _context), do: query

  defp maybe_filter_thread(query, %{thread: :all}), do: query

  defp maybe_filter_thread(query, %{thread: thread}) do
    where(query, [comment], comment.thread == ^thread)
  end

  defp lifecycle_scope(query, %{thread: :doc}), do: doc_lifecycle_scope(query)

  defp lifecycle_scope(query, %{thread: :all}), do: all_lifecycle_scope(query)

  defp lifecycle_scope(query, _context), do: threaded_lifecycle_scope(query)

  defp doc_lifecycle_scope(query) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      join: doc_lifecycle in ArticleLifecycle,
      as: :gate_doc_lifecycle,
      on: doc_lifecycle.article_id == comment.article_id,
      where: lifecycle.state != :destroy,
      where: doc_lifecycle.state in [:published, :archived]
    )
  end

  # The branching here is a single SQL predicate covering Post and Doc rows;
  # splitting it would duplicate the query and change the join semantics.
  # credo:disable-for-next-line Credo.Check.Refactor.CyclomaticComplexity
  defp all_lifecycle_scope(query) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      left_join: article_lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on: article_lifecycle.article_id == comment.article_id and comment.thread != ^:doc,
      left_join: doc_lifecycle in ArticleLifecycle,
      as: :gate_doc_lifecycle,
      on: doc_lifecycle.article_id == comment.article_id and comment.thread == ^:doc,
      where: lifecycle.state != :destroy,
      where:
        (comment.thread != ^:doc and article_lifecycle.state in [:published, :archived]) or
          (comment.thread == ^:doc and doc_lifecycle.state in [:published, :archived])
    )
  end

  defp threaded_lifecycle_scope(query) do
    from(comment in query,
      join: lifecycle in CommentLifecycle,
      as: :gate_comment_lifecycle,
      on: lifecycle.comment_id == comment.id,
      join: article_lifecycle in ArticleLifecycle,
      as: :gate_article_lifecycle,
      on: article_lifecycle.article_id == comment.article_id,
      where: lifecycle.state != :destroy,
      where: article_lifecycle.state in [:published, :archived]
    )
  end

  defp public_parent(query, actor, context) do
    threads =
      if context.thread == :all, do: [:post, :blog, :changelog, :doc], else: [context.thread]

    allowed =
      Enum.reduce(threads, dynamic(false), fn thread, predicate ->
        scope =
          if thread == :doc do
            GroupherServer.CMS.Gate.Context.Scope.Doc.public()
          else
            GroupherServer.CMS.Gate.Context.Scope.Article.public(thread)
          end

        binding_ids =
          GroupherServer.CMS.Gate.Scope.Article.scope_with_review_policy(
            Ecto.Queryable.to_query(GroupherServer.CMS.Model.Article),
            actor,
            :read,
            scope
          )
          |> select([gate_article_binding: binding], binding.id)

        dynamic(
          [gate_comment_binding: binding],
          ^predicate or binding.id in subquery(binding_ids)
        )
      end)

    where(query, ^allowed)
  end

  defp public_comment(query, %User{id: user_id}) do
    {platform_read?, community_read?} = review_access_predicates(user_id)

    from(comment in query,
      where:
        comment.author_id == ^user_id or
          ((not exists(
              from(restriction in CommentReviewBlock,
                where:
                  restriction.comment_id == parent_as(:gate_comment_lifecycle).comment_id and
                    is_nil(restriction.community_id) and is_nil(restriction.resolved_at),
                select: 1
              )
            ) or exists(subquery(platform_read?))) and
             (comment.thread != :doc or
                not exists(
                  from(restriction in CommentReviewBlock,
                    where:
                      restriction.comment_id == parent_as(:gate_comment_lifecycle).comment_id and
                        restriction.community_id == parent_as(:gate_community).id and
                        is_nil(restriction.resolved_at),
                    select: 1
                  )
                ) or exists(subquery(platform_read?)) or
                  exists(subquery(community_read?))))
    )
  end

  defp public_comment(query, _actor) do
    from(comment in query,
      where:
        not exists(
          from(restriction in CommentReviewBlock,
            where:
              restriction.comment_id == parent_as(:gate_comment_lifecycle).comment_id and
                is_nil(restriction.resolved_at) and is_nil(restriction.community_id),
            select: 1
          )
        ) and
          (comment.thread != :doc or
             not exists(
               from(restriction in CommentReviewBlock,
                 where:
                   restriction.comment_id == parent_as(:gate_comment_lifecycle).comment_id and
                     restriction.community_id == parent_as(:gate_community).id and
                     is_nil(restriction.resolved_at),
                 select: 1
               )
             ))
    )
  end

  defp review_access_predicates(user_id) do
    with {:ok, platform_read?} <-
           CMS.Passport.Store.action_predicate(
             user_id,
             :global,
             CMS.GateAction.review_platform_read()
           ),
         {:ok, community_read?} <-
           CMS.Passport.Store.action_predicate(
             user_id,
             {:community_binding, :gate_community},
             CMS.GateAction.review_read()
           ) do
      {platform_read?, community_read?}
    else
      _ -> {denied_action_query(), denied_action_query()}
    end
  end

  defp denied_action_query do
    from(passport in CMS.Model.GlobalPassport, where: false, select: 1)
  end
end
