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

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.Workflow
  alias CMS.Articles.{Bindings, Draft.Store, Effects, Numbering, Revision}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBodySnapshot,
    ArticleAssetRef,
    ArticleRevision,
    Author,
    DocBranchVersion,
    DocBranchVersionCounter,
    DocBranch,
    DocBranchState,
    DocLifecycle,
    DocPublic,
    DocReviewBlock,
    DocRevision,
    CommunityAsset
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
      Workflow.transaction(fn ->
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
             {:ok, _public} <- select_public(article, version, revision, actor, lifecycle),
             {:ok, _} <- CMS.ArticleStats.initialize(article),
             {:ok, published_lifecycle} <- publish_lifecycle(lifecycle),
             {:ok, _review} <-
               register_review(
                 article,
                 community,
                 branch,
                 revision,
                 version,
                 published_lifecycle,
                 first_publish?,
                 opts
               ),
             {:ok, public} <- load_public(article.id, branch_id),
             {:ok, _invalidation} <-
               invalidate_public_cache(article, branch, binding, community, first_publish?, opts),
             {:ok, _projection} <-
               enqueue_public_projection(
                 article,
                 branch,
                 binding,
                 community,
                 revision,
                 actor,
                 first_publish?,
                 opts
               ),
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

  defp register_review(
         article,
         _community,
         branch,
         revision,
         _version,
         lifecycle,
         first_publish?,
         _opts
       ) do
    with {:ok, configs} <- ReviewBot.configs(nil, :doc),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id) do
      content = %{
        title: revision.title || "",
        body: body.plain_text || "",
        images: review_images(revision.id)
      }

      target = %{
        type: :doc,
        article_id: article.id,
        branch_id: branch.id,
        lifecycle: lifecycle
      }

      CMS.Review.RequestSubmission.register_in_transaction(
        target,
        content,
        configs,
        if(first_publish?, do: :publish, else: :edit)
      )
    else
      nil ->
        {:error, CMS.ErrorCat.invalid_review_block()}

      {:error, _reason} = error ->
        error
    end
  end

  defp review_images(revision_id) do
    ArticleAssetRef
    |> join(:inner, [ref], asset in CommunityAsset, on: asset.id == ref.asset_id)
    |> where(
      [ref, asset],
      ref.revision_id == ^revision_id and ref.usage in [:inline, :cover, :cover_dark] and
        asset.asset_type == :image
    )
    |> order_by([ref, _asset], asc: ref.position, asc: ref.id)
    |> select([ref, asset], %{
      asset_id: ref.asset_id,
      immutable_version: fragment("COALESCE(?, ?)", asset.content_hash, asset.url_hash)
    })
    |> Repo.all()
  end

  defp load_public(article_id, branch_id) do
    case Repo.get_by(DocPublic, article_id: article_id, branch_id: branch_id) do
      %DocPublic{} = public -> {:ok, public}
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp binding_community(opts, article, branch_id) do
    case Keyword.get(opts, :community) do
      %GroupherServer.CMS.Model.Community{} = community ->
        {:ok, community}

      _ ->
        binding_community_by_id_or_branch(opts, article, branch_id)
    end
  end

  defp binding_community_by_id_or_branch(opts, article, branch_id) do
    case Keyword.get(opts, :community_id) do
      community_id when is_integer(community_id) -> load_community(community_id)
      _community_id -> binding_community_by_branch(article, branch_id)
    end
  end

  defp binding_community_by_branch(article, branch_id) do
    case Repo.get(DocBranch, branch_id) do
      %DocBranch{community_id: community_id} -> load_community(community_id)
      _branch -> binding_community_by_article(article)
    end
  end

  defp load_community(community_id) do
    case Repo.get(GroupherServer.CMS.Model.Community, community_id) do
      %GroupherServer.CMS.Model.Community{} = community -> {:ok, community}
      _community -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  defp binding_community_by_article(article) do
    case Bindings.get(article, Map.get(article, :community)) do
      {:ok, %{community: community}} -> {:ok, community}
      {:error, reason} -> {:error, reason}
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

  defp select_public(article, version, revision, actor, lifecycle) do
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
      visible:
        not Repo.exists?(
          from(restriction in DocReviewBlock,
            where:
              restriction.article_id == ^lifecycle.article_id and
                restriction.branch_id == ^lifecycle.branch_id and
                is_nil(restriction.resolved_at)
          )
        )
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
      nil -> {:error, ArticleErrorCat.binding_not_found()}
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

  defp valid_slug(slug) do
    if(Slug.valid?(slug), do: {:ok, :pass}, else: {:error, :invalid_slug})
  end

  defp invalidate_public_cache(_article, _branch, nil, _community, _first?, _opts) do
    {:ok, :not_public_path}
  end

  defp invalidate_public_cache(
         article,
         %DocBranch{type: :main} = branch,
         binding,
         community,
         first_publish?,
         opts
       ) do
    with %ArticleBinding{inner_id: inner_id} <- binding,
         true <- is_integer(inner_id),
         {:ok, identity} <- outbox_identity(opts) do
      Effects.enqueue(
        if(first_publish?, do: "article.published", else: "article.updated"),
        "article",
        article.id,
        identity,
        %{
          community: community.slug,
          community_id: community.id,
          thread: :doc,
          inner_id: inner_id,
          article_id: article.id
        },
        effect_key:
          "article:#{article.id}:#{branch.id}:#{if(first_publish?, do: "published", else: "updated")}"
      )
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

  defp enqueue_public_projection(
         article,
         %DocBranch{type: :main} = branch,
         %ArticleBinding{inner_id: inner_id},
         community,
         revision,
         actor,
         first_publish?,
         opts
       )
       when is_integer(inner_id) do
    with {:ok, identity} <- outbox_identity(opts) do
      Effects.enqueue(
        "article.projections",
        "article",
        article.id,
        identity,
        %{
          first_publish?: first_publish?,
          community_id: community.id,
          inner_id: inner_id,
          branch_id: branch.id,
          branch_type: branch.type,
          changed_fields: [],
          published_by_id: actor.id,
          revision_id: revision.id
        },
        effect_key: "article-projections:#{community.id}:#{inner_id}",
        retry_failed: true
      )
    end
  end

  defp enqueue_public_projection(
         _article,
         %DocBranch{},
         _binding,
         _community,
         _revision,
         _actor,
         _first_publish?,
         _opts
       ) do
    {:ok, :branch_not_public}
  end

  defp outbox_identity(opts) do
    case Keyword.get(opts, :causation_id) || Keyword.get(opts, :command_id) do
      command_id when is_binary(command_id) ->
        case Ecto.UUID.cast(command_id) do
          {:ok, command_id} -> {:ok, {:command, command_id}}
          :error -> {:error, :outbox_command_id_required}
        end

      nil ->
        case Keyword.get(opts, :workflow_ref) do
          workflow_ref when is_binary(workflow_ref) and workflow_ref != "" ->
            {:ok, {:workflow, workflow_ref}}

          _ ->
            {:error, :outbox_identity_required}
        end
    end
  end
end
