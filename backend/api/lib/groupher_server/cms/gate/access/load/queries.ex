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
        -> locked Lifecycle / binding rows
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
    DocsLifecycle
  }

  @doc """
  Locks binding Communities for an Article, then reloads its row under `FOR UPDATE`.

  This lock protects the canonical resource consumed by the surrounding Gate
  transaction; callers must not use it as a general resource reader.
  """
  def resource(CMS.Model.Article = schema, id) when not is_nil(id) do
    {:ok, :pass} = CMS.Articles.MutationLock.lock_community_admission(id)
    schema |> where([resource], resource.id == ^id) |> lock("FOR UPDATE") |> Repo.one()
  end

  def resource(schema, id) when is_atom(schema) and not is_nil(id) do
    schema
    |> where([resource], resource.id == ^id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc "Loads the current Article row without acquiring a new lock."
  def resource_snapshot(CMS.Model.Article = schema, id) when not is_nil(id) do
    Repo.get(schema, id)
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

  @doc "Reads the Article binding inside an already admitted transaction."
  def article_binding_snapshot(article_id, community_id) do
    Repo.one(
      from(binding in ArticleBinding,
        where: binding.article_id == ^article_id and binding.community_id == ^community_id
      )
    )
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

  @doc "Reads Community lifecycle facts without changing lock order."
  def community_lifecycle_snapshot(community_id) do
    Repo.one(
      from(lifecycle in CommunityLifecycle, where: lifecycle.community_id == ^community_id)
    )
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
        article_review_scope_keys_for_article(article_id, community_id)

      nil ->
        []
    end
  end

  @doc "Returns active review scopes for an Article identity and its Community."
  def article_review_scope_keys_for_article(article_id, community_id) do
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
  end

  @doc "Locks the branch-free Lifecycle for a Doc in its owner Community."
  def doc_site_lifecycle(article_id, community_id) do
    DocsLifecycle
    |> where(
      [lifecycle],
      lifecycle.article_id == ^article_id and lifecycle.community_id == ^community_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  @doc "Reads stable Doc lifecycle and review facts for its owner Community."
  def doc_site_lifecycle_snapshot(article_id, community_id) do
    Repo.one(
      from(lifecycle in DocsLifecycle,
        where: lifecycle.article_id == ^article_id and lifecycle.community_id == ^community_id
      )
    )
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
