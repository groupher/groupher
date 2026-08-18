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

  alias GroupherServer.CMS.Model.{
    ArticleLifecycle,
    CommentLifecycle,
    CommunityLifecycle,
    DocBranch,
    DocLifecycle
  }

  alias GroupherServer.Repo

  @doc false
  def resource(schema, id) when is_atom(schema) and not is_nil(id) do
    schema
    |> where([resource], resource.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc false
  def community_lifecycle(community_id) do
    CommunityLifecycle
    |> where([lifecycle], lifecycle.community_id == ^community_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  @doc false
  def article_lifecycle(community_id, thread, article_hash_id) do
    ArticleLifecycle
    |> where(
      [lifecycle],
      lifecycle.community_id == ^community_id and lifecycle.thread == ^thread and
        lifecycle.article_hash_id == ^article_hash_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc false
  def doc_lifecycle(community_id, branch_id, article_hash_id) do
    DocLifecycle
    |> where(
      [lifecycle],
      lifecycle.community_id == ^community_id and lifecycle.branch_id == ^branch_id and
        lifecycle.article_hash_id == ^article_hash_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc false
  def doc_branch(community_id, branch_id) do
    DocBranch
    |> where([branch], branch.community_id == ^community_id and branch.id == ^branch_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  @doc false
  def comment_lifecycle(comment_id) do
    CommentLifecycle
    |> where([lifecycle], lifecycle.comment_id == ^comment_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end
end
