defmodule GroupherServer.CMS.Articles.Publish.Doc do
  @moduledoc """
  Publishes a branch-scoped Doc Draft as one immutable branch version.

      Article + Branch lock
        -> Draft -> Revision -> DocBranchVersion -> DocPublic
        -> Lifecycle published -> Draft removed

  The counter, immutable version and selected public projection are committed
  together, so failed transactions never leave a visible version-number gap.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Draft.Store, Numbering, Revision}

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleBodySnapshot,
    ArticleRevision,
    Author,
    DocBranchVersion,
    DocBranchVersionCounter,
    DocBranch,
    DocBranchState,
    DocLifecycle,
    DocPublic,
    DocRevision,
    Community
  }

  alias Helper.Validator.Slug

  @doc "Publishes one Doc Draft with Draft and Lifecycle optimistic guards."
  @spec publish(Article.t(), pos_integer(), Author.t(), keyword()) ::
          {:ok,
           %{
             branch_type: atom(),
             revision: ArticleRevision.t(),
             version: DocBranchVersion.t(),
             public: DocPublic.t()
           }}
          | {:error, term()}
  def publish(%Article{thread: :doc} = article, branch_id, %Author{} = actor, opts) do
    Repo.transaction(fn ->
      with {:ok, article} <- lock_article(article.id),
           {:ok, branch} <- lock_branch(branch_id, article.community_id),
           {:ok, draft} <- Store.get_for_update(article, branch_id: branch_id),
           :ok <- valid_slug(draft.slug),
           :ok <- same_version(draft.version, Keyword.fetch!(opts, :expected_draft_version)),
           {:ok, lifecycle} <- lock_lifecycle(article.id, branch_id),
           :ok <-
             same_lifecycle_version(
               lifecycle.version,
               Keyword.fetch!(opts, :expected_lifecycle_version)
             ),
           first_publish? <-
             is_nil(Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id)),
           {:ok, article} <- maybe_assign_public_inner_id(article, branch),
           {:ok, revision} <- Revision.create(article, draft),
           {:ok, version_number} <- allocate_version(article.id, branch_id),
           {:ok, version} <-
             insert_version(article, branch_id, revision, actor, version_number, opts),
           {:ok, _branch_state} <-
             activate_branch_state(article.id, branch_id, version.published_at),
           {:ok, public} <- select_public(article, version, revision, actor),
           :ok <- CMS.ArticleStats.initialize(article),
           {:ok, _lifecycle} <- publish_lifecycle(lifecycle),
           {:ok, _invalidation} <-
             invalidate_public_cache(article, branch, first_publish?, opts),
           :ok <- Store.delete_workspace(article, draft) do
        %{
          article: article,
          branch_type: branch.type,
          revision: revision,
          version: version,
          public: public,
          first_publish?: first_publish?,
          published_by_id: actor.id
        }
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp lock_article(article_id) do
    Article
    |> where([article], article.id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> present(:article_not_found)
  end

  defp lock_branch(branch_id, community_id) do
    DocBranch
    |> where(
      [branch],
      branch.id == ^branch_id and branch.community_id == ^community_id
    )
    |> lock("FOR SHARE")
    |> Repo.one()
    |> present(:branch_not_found)
  end

  defp lock_lifecycle(article_id, branch_id) do
    DocLifecycle
    |> where(
      [lifecycle],
      lifecycle.article_id == ^article_id and lifecycle.branch_id == ^branch_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> present(:lifecycle_not_found)
  end

  defp allocate_version(article_id, branch_id) do
    %DocBranchVersionCounter{}
    |> DocBranchVersionCounter.changeset(%{
      article_id: article_id,
      branch_id: branch_id,
      next_version_number: 1
    })
    |> Repo.insert(on_conflict: :nothing, conflict_target: [:article_id, :branch_id])

    counter =
      DocBranchVersionCounter
      |> where([counter], counter.article_id == ^article_id and counter.branch_id == ^branch_id)
      |> lock("FOR UPDATE")
      |> Repo.one!()

    version_number = counter.next_version_number

    case counter
         |> DocBranchVersionCounter.changeset(%{next_version_number: version_number + 1})
         |> Repo.update() do
      {:ok, _counter} -> {:ok, version_number}
      {:error, reason} -> {:error, reason}
    end
  end

  defp insert_version(article, branch_id, revision, actor, version_number, opts) do
    %DocBranchVersion{}
    |> DocBranchVersion.changeset(%{
      article_id: article.id,
      branch_id: branch_id,
      revision_id: revision.id,
      version_number: version_number,
      published_by_id: actor.id,
      published_at: DateTime.utc_now(:second),
      message: Keyword.get(opts, :message)
    })
    |> Repo.insert()
  end

  defp select_public(article, version, revision, actor) do
    body = Repo.get!(ArticleBodySnapshot, revision.body_snapshot_id)
    extension = Repo.get_by!(DocRevision, revision_id: revision.id)
    current = Repo.get_by(DocPublic, article_id: article.id, branch_id: version.branch_id)
    state = Repo.get_by!(DocBranchState, article_id: article.id, branch_id: version.branch_id)

    attrs = %{
      article_id: article.id,
      branch_id: version.branch_id,
      branch_version_id: version.id,
      published_at: version.published_at,
      published_by_id: actor.id,
      publication_version: if(current, do: current.publication_version + 1, else: 1),
      title: revision.title,
      digest: revision.digest,
      slug: revision.slug,
      subtitle: extension.subtitle,
      body_hash: body.body_hash,
      excerpt: body.plain_text,
      thumbnail: body.thumbnail,
      active_at: state.active_at || version.published_at,
      is_edited: state.is_edited,
      visible: state.moderation_state == :legal
    }

    (current || %DocPublic{})
    |> DocPublic.changeset(attrs)
    |> then(fn changeset ->
      if current, do: Repo.update(changeset), else: Repo.insert(changeset)
    end)
  end

  defp publish_lifecycle(lifecycle) do
    lifecycle
    |> DocLifecycle.changeset(%{
      state: :published,
      version: lifecycle.version + 1,
      changed_at: DateTime.utc_now(:second)
    })
    |> Repo.update()
  end

  defp maybe_assign_public_inner_id(article, %DocBranch{type: :main}) do
    with %ArticleCommunity{} = relation <-
           Repo.get_by(ArticleCommunity,
             article_id: article.id,
             community_id: article.community_id
           ),
         {:ok, relation} <- Numbering.assign_relation_inner_id(relation) do
      {:ok, %{article | inner_id: relation.inner_id}}
    else
      nil -> {:error, :article_community_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp maybe_assign_public_inner_id(article, %DocBranch{}), do: {:ok, article}

  defp activate_branch_state(article_id, branch_id, published_at) do
    state = Repo.get_by!(DocBranchState, article_id: article_id, branch_id: branch_id)

    if state.active_at do
      {:ok, state}
    else
      state |> DocBranchState.changeset(%{active_at: published_at}) |> Repo.update()
    end
  end

  defp same_version(version, version), do: :ok
  defp same_version(_actual, _expected), do: {:error, :draft_version_conflict}
  defp same_lifecycle_version(version, version), do: :ok
  defp same_lifecycle_version(_actual, _expected), do: {:error, :lifecycle_version_conflict}
  defp present(nil, error), do: {:error, error}
  defp present(value, _error), do: {:ok, value}

  defp valid_slug(slug), do: if(Slug.valid?(slug), do: :ok, else: {:error, :invalid_slug})

  defp invalidate_public_cache(%Article{inner_id: inner_id}, _branch, _first?, _opts)
       when not is_integer(inner_id) do
    {:ok, :not_public_path}
  end

  defp invalidate_public_cache(article, %DocBranch{type: :main}, first_publish?, opts) do
    with %Community{} = community <- Repo.get(Community, article.community_id) do
      CMS.Outbox.send(%{
        event: if(first_publish?, do: "article.published", else: "article.updated"),
        worker: CMS.Outbox.Workers.Article.Cleanup,
        resource_type: "article",
        resource_id: article.id,
        command_id: Keyword.get(opts, :causation_id, Ecto.UUID.generate()),
        data: %{
          community: community.slug,
          community_id: community.id,
          thread: :doc,
          inner_id: article.inner_id,
          article_id: article.id
        }
      })
    else
      nil -> {:error, :community_not_found}
    end
  end

  defp invalidate_public_cache(_article, %DocBranch{}, _first_publish?, _opts) do
    {:ok, :branch_not_public}
  end
end
