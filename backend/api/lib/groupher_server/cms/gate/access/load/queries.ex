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
    ArticleCommunity,
    CommentLifecycle,
    CommunityLifecycle,
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

  @doc "Loads one ArticleCommunity relation under `FOR SHARE` while checking membership."
  def article_community(article_id, community_id) do
    ArticleCommunity
    |> where(
      [relation],
      relation.article_id == ^article_id and relation.community_id == ^community_id
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
