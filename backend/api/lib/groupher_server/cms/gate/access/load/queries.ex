defmodule GroupherServer.CMS.Gate.Access.Load.Queries do
  @moduledoc """
  Shared locked database queries for Access Context loaders.

  This module owns only row lookup and locking. Resource loaders assemble the
  returned rows into typed contexts; Access policies remain the consumers.

  These query functions are internal implementation seams. They must not be
  used as general Lifecycle readers because their lock mode and selected rows
  are part of Gate access-check semantics.

      Access.Load.*
        -> Load.Queries
        -> locked Lifecycle / branch rows
        -> typed Access Context
        -> Access policy
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleLifecycle,
    ArticleBinding,
    CommentLifecycle,
    CommunityLifecycle,
    ArticleReviewBlock,
    DocReviewBlock,
    DocBranch,
    DocBranchState,
    DocLifecycle
  }

  @doc """
  Reloads one resource row by primary key under `FOR UPDATE`.

  This lock protects the canonical resource consumed by the surrounding Gate
  transaction; callers must not use it as a general resource reader.
  """
  def resource(schema, id) when is_atom(schema) and not is_nil(id) do
    schema
    |> where([resource], resource.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc "Loads one ArticleBinding binding under `FOR SHARE` while checking membership."
  def article_binding(article_id, community_id) do
    ArticleBinding
    |> where(
      [binding],
      binding.article_id == ^article_id and binding.community_id == ^community_id
    )
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  @doc """
  Loads a Community lifecycle row under `FOR SHARE` for ancestor-state checks.
  """
  def community_lifecycle(community_id) do
    CommunityLifecycle
    |> where([lifecycle], lifecycle.community_id == ^community_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  @doc "Loads the Lifecycle keyed by one stable Article under `FOR UPDATE`."
  @spec article_lifecycle(Ecto.UUID.t()) :: ArticleLifecycle.t() | nil
  def article_lifecycle(article_id) do
    ArticleLifecycle
    |> where([lifecycle], lifecycle.article_id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc """
  Checks for an active restriction matching one Article lifecycle and community.

  ## Examples

      Queries.article_review_restricted?(lifecycle_id, community_id)
      #=> true | false
  """
  def article_review_restricted?(lifecycle_id, community_id) do
    article_review_scope_keys(lifecycle_id, community_id) != []
  end

  @doc "Returns the active platform and community review scopes for an Article binding."
  def article_review_scope_keys(lifecycle_id, community_id) do
    case Repo.get(ArticleLifecycle, lifecycle_id) do
      %ArticleLifecycle{article_id: article_id} ->
        ArticleReviewBlock
        |> where(
          [restriction],
          restriction.article_id == ^article_id and is_nil(restriction.resolved_at) and
            (is_nil(restriction.community_id) or restriction.community_id == ^community_id)
        )
        |> select([restriction], restriction.community_id)
        |> Repo.all()
        |> Enum.map(fn
          nil -> "platform"
          id -> "community:#{id}"
        end)

      nil ->
        []
    end
  end

  @doc "Loads a branch Lifecycle keyed by one stable Doc Article under `FOR UPDATE`."
  @spec doc_lifecycle(Ecto.UUID.t(), pos_integer()) :: DocLifecycle.t() | nil
  def doc_lifecycle(article_id, branch_id) do
    DocLifecycle
    |> where(
      [lifecycle],
      lifecycle.article_id == ^article_id and lifecycle.branch_id == ^branch_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc """
  Checks for an active platform restriction on one Doc branch lifecycle.

  ## Examples

      Queries.doc_review_restricted?(lifecycle_id)
      #=> true | false
  """
  def doc_review_restricted?(lifecycle_id) do
    doc_review_scope_keys(lifecycle_id) != []
  end

  @doc "Returns the active review scopes for a Doc branch."
  def doc_review_scope_keys(lifecycle_id) do
    case Repo.get(DocLifecycle, lifecycle_id) do
      %DocLifecycle{article_id: article_id, branch_id: branch_id} ->
        count =
          Repo.aggregate(
            from(restriction in DocReviewBlock,
              where:
                restriction.article_id == ^article_id and restriction.branch_id == ^branch_id and
                  is_nil(restriction.resolved_at)
            ),
            :count
          )

        if count > 0, do: ["platform"], else: []

      nil ->
        []
    end
  end

  @doc """
  Loads a Doc branch under `FOR SHARE` so policy can enforce branch capability.
  """
  def doc_branch(community_id, branch_id) do
    DocBranch
    |> where([branch], branch.community_id == ^community_id and branch.id == ^branch_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  @doc "Loads branch-scoped Doc runtime facts under `FOR UPDATE`."
  @spec doc_branch_state(Ecto.UUID.t(), pos_integer()) :: DocBranchState.t() | nil
  def doc_branch_state(article_id, branch_id) do
    DocBranchState
    |> where([state], state.article_id == ^article_id and state.branch_id == ^branch_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc """
  Loads a Comment lifecycle row under `FOR UPDATE` for mutation admission.
  """
  def comment_lifecycle(comment_id) do
    CommentLifecycle
    |> where([lifecycle], lifecycle.comment_id == ^comment_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end
end
