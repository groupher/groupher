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
  alias CMS.Articles.{Bindings, Draft.Store, Numbering, Revision}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBodySnapshot,
    ArticleRevision,
    Author,
    DocBranchVersion,
    DocBranchVersionCounter,
    DocBranch,
    DocBranchState,
    DocLifecycle,
    DocPublic,
    DocRevision
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
    with {:ok, community} <- binding_community(opts, article, branch_id) do
      Repo.transaction(fn ->
        with {:ok, article} <- lock_article(article.id),
             {:ok, branch} <- lock_branch(branch_id, community.id),
             {:ok, draft} <- Store.get_for_update(article, branch_id: branch_id),
             {:ok, _} <- valid_slug(draft.slug),
             {:ok, _} <-
               same_version(draft.version, Keyword.fetch!(opts, :expected_draft_version)),
             {:ok, lifecycle} <- lock_lifecycle(article.id, branch_id),
             {:ok, _} <-
               same_lifecycle_version(
                 lifecycle.version,
                 Keyword.fetch!(opts, :expected_lifecycle_version)
               ),
             first_publish? <-
               is_nil(Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id)),
             {:ok, article, binding} <- maybe_assign_public_inner_id(article, branch, community),
             {:ok, revision} <- Revision.create(article, draft),
             {:ok, version_number} <- allocate_version(article.id, branch_id),
             {:ok, version} <-
               insert_version(article, branch_id, revision, actor, version_number, opts),
             {:ok, _branch_state} <-
               activate_branch_state(article.id, branch_id, version.published_at),
             {:ok, public} <- select_public(article, version, revision, actor),
             {:ok, _} <- CMS.ArticleStats.initialize(article),
             {:ok, _lifecycle} <- publish_lifecycle(lifecycle),
             {:ok, _invalidation} <-
               invalidate_public_cache(article, branch, binding, community, first_publish?, opts),
             {:ok, _} <- Store.delete_workspace(article, draft) do
          %{
            article: article,
            community: community,
            binding: binding,
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
  end

  defp binding_community(opts, article, branch_id) do
    case Keyword.get(opts, :community) do
      %GroupherServer.CMS.Model.Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case Repo.get(GroupherServer.CMS.Model.Community, community_id) do
              %GroupherServer.CMS.Model.Community{} = community -> {:ok, community}
              _ -> {:error, :article_binding_not_found}
            end

          _ ->
            case Repo.get(DocBranch, branch_id) do
              %DocBranch{community_id: community_id} ->
                case Repo.get(GroupherServer.CMS.Model.Community, community_id) do
                  %GroupherServer.CMS.Model.Community{} = community -> {:ok, community}
                  _ -> {:error, :article_binding_not_found}
                end

              _ ->
                case Bindings.get(article, Map.get(article, :community)) do
                  {:ok, %{community: community}} -> {:ok, community}
                  {:error, reason} -> {:error, reason}
                end
            end
        end
    end
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

  defp maybe_assign_public_inner_id(article, %DocBranch{type: :main}, community) do
    with %ArticleBinding{} = binding <-
           Repo.get_by(ArticleBinding,
             article_id: article.id,
             community_id: community.id
           ),
         {:ok, binding} <- Numbering.assign_binding_inner_id(binding) do
      {:ok, article, binding}
    else
      nil -> {:error, :article_binding_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp maybe_assign_public_inner_id(article, %DocBranch{}, community) do
    {:ok, article,
     Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id)}
  end

  defp activate_branch_state(article_id, branch_id, published_at) do
    state = Repo.get_by!(DocBranchState, article_id: article_id, branch_id: branch_id)

    if state.active_at do
      {:ok, state}
    else
      state |> DocBranchState.changeset(%{active_at: published_at}) |> Repo.update()
    end
  end

  defp same_version(version, version), do: {:ok, :pass}
  defp same_version(_actual, _expected), do: {:error, :draft_version_conflict}
  defp same_lifecycle_version(version, version), do: {:ok, :pass}
  defp same_lifecycle_version(_actual, _expected), do: {:error, :lifecycle_version_conflict}
  defp present(nil, error), do: {:error, error}
  defp present(value, _error), do: {:ok, value}

  defp valid_slug(slug),
    do: if(Slug.valid?(slug), do: {:ok, :pass}, else: {:error, :invalid_slug})

  defp invalidate_public_cache(_article, _branch, nil, _community, _first?, _opts) do
    {:ok, :not_public_path}
  end

  defp invalidate_public_cache(
         article,
         %DocBranch{type: :main},
         binding,
         community,
         first_publish?,
         opts
       ) do
    with %ArticleBinding{inner_id: inner_id} <- binding,
         true <- is_integer(inner_id) do
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
          inner_id: inner_id,
          article_id: article.id
        }
      })
    else
      false -> {:ok, :not_public_path}
    end
  end

  defp invalidate_public_cache(
         _article,
         %DocBranch{},
         _binding,
         _community,
         _first_publish?,
         _opts
       ) do
    {:ok, :branch_not_public}
  end
end
