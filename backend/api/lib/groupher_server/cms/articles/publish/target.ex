defmodule GroupherServer.CMS.Articles.Publish.Target do
  @moduledoc """
  Executes the stable Article Draft-to-Revision publication transaction.

      stable Article lock -> Draft -> Revision -> Public -> delete Draft

  Gate admission and post-commit effects remain at the authenticated command
  boundary; this module owns the atomic persistence transition.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.{Workflow, Tags.Assignment}
  alias CMS.Articles.{Bindings, Draft, Draft.Store, Lifecycle, Numbering, Public, Revision}

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleBinding,
    ArticleLifecycle,
    ArticleBodySnapshot,
    ArticlePublic,
    ArticleRevision,
    Author,
    Community,
    CommunityAsset
  }

  @doc "Publishes one ordinary Draft after validating the caller-observed Draft version.

  Pass `:community` (or a persisted `:community_id`); publication never guesses a
  binding from the stable Article."
  @spec publish(Article.t(), Author.t(), keyword()) ::
          {:ok,
           %{
             article: Article.t(),
             public: ArticlePublic.t(),
             revision: CMS.Model.ArticleRevision.t(),
             first_publish?: boolean()
           }}
          | {:error, term()}
  def publish(%Article{thread: thread} = article, %Author{} = actor, opts)
      when thread in [:post, :blog, :changelog] do
    expected_version = Keyword.fetch!(opts, :expected_draft_version)
    expected_lifecycle_version = Keyword.fetch!(opts, :expected_lifecycle_version)
    published_at = DateTime.utc_now(:second)

    with {:ok, %{community: community}} <- binding_context(article, opts) do
      Workflow.transaction(fn ->
        with {:ok, locked_article} <- lock_article(article.id),
             {:ok, draft} <- Store.get_for_update(locked_article),
             {:ok, _} <- validate_version(draft.version, expected_version),
             {:ok, lifecycle} <- Lifecycle.lock(locked_article),
             {:ok, _} <- validate_lifecycle_version(lifecycle.version, expected_lifecycle_version),
             current_public <- Repo.get(ArticlePublic, locked_article.id),
             first_publish? <- is_nil(current_public),
             changed_fields <- changed_fields(locked_article, current_public, draft),
             {:ok, binding} <- ensure_binding(locked_article, community),
             {:ok, binding} <- Numbering.assign_binding_inner_id(binding),
             {:ok, locked_article} <- ensure_active_at(locked_article, published_at),
             {:ok, revision} <- Revision.create(locked_article, draft),
             {:ok, public} <-
               Public.select(locked_article, revision, actor, published_at: published_at),
             {:ok, _} <- CMS.ArticleStats.initialize(locked_article),
             {:ok, lifecycle} <- Lifecycle.transition(lifecycle, :published),
             {:ok, _review} <-
               register_review(
                 locked_article,
                 community,
                 revision,
                 lifecycle,
                 first_publish?,
                 opts
               ),
             {:ok, _} <- sync_community_tags(locked_article, community, opts),
             {:ok, _binding} <-
               CMS.Articles.BindingPersist.ensure_binding(locked_article, community),
             {:ok, _} <- Store.delete_workspace(locked_article, draft) do
          %{
            article: locked_article,
            community: community,
            binding: binding,
            public: public,
            revision: revision,
            first_publish?: first_publish?,
            changed_fields: changed_fields,
            published_by_id: actor.id
          }
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def publish(%Article{thread: :doc}, %Author{}, _opts), do: {:error, :use_docs_publish}

  @doc "Applies one destination Community's review policy to an already-published Article binding."
  @spec register_binding_review(Article.t(), Community.t(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def register_binding_review(%Article{} = article, %Community{} = community, operation_ref)
      when is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         %ArticleLifecycle{} = lifecycle <- lock_review_lifecycle(article.id) do
      if lifecycle.state in [:published, :archived] do
        register_published_binding_review(article, community, lifecycle, operation_ref)
      else
        {:ok, :pass}
      end
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      nil -> {:error, CMS.Articles.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  @doc "Ends one source Community's review scope when an Article binding moves away."
  @spec remove_binding_review(Article.t(), Community.t(), Ecto.UUID.t()) ::
          {:ok, :pass} | {:error, term()}
  def remove_binding_review(%Article{} = article, %Community{id: community_id}, operation_ref)
      when is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         %ArticleLifecycle{} <- lock_review_lifecycle(article.id),
         {:ok, :pass} <-
           CMS.Review.Requests.supersede_scope_in_transaction(
             %{type: :article, article_id: article.id, community_id: community_id},
             operation_ref
           ) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      nil -> {:error, CMS.Articles.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp register_review(article, _community, revision, lifecycle, first_publish?, _opts) do
    community_ids = binding_community_ids(article.id)

    with {:ok, configs} <- ReviewBot.configs_for_targets(community_ids, :article),
         {:ok, content} <- review_content(revision) do
      target = %{
        type: :article,
        article_id: article.id,
        lifecycle: lifecycle
      }

      trigger = if(first_publish?, do: :publish, else: :edit)

      CMS.Review.RequestSubmission.register_in_transaction(target, content, configs, trigger)
    else
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
      {:error, _reason} = error -> error
    end
  end

  defp register_published_binding_review(article, community, lifecycle, _operation_ref) do
    with {:ok, configs} <- ReviewBot.configs(community.id, :article),
         {:ok, content} <- current_review_content(article.id),
         target <- %{
           type: :article,
           article_id: article.id,
           lifecycle: lifecycle
         },
         {:ok, _registered} <-
           CMS.Review.RequestSubmission.register_in_transaction(
             target,
             content,
             configs,
             :binding
           ) do
      {:ok, :pass}
    else
      nil -> {:error, ReviewBot.config_not_found_error()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp current_review_content(article_id) do
    case Repo.one(
           from(public in ArticlePublic,
             join: revision in ArticleRevision,
             on: revision.id == public.revision_id,
             join: body in ArticleBodySnapshot,
             on: body.id == revision.body_snapshot_id,
             where: public.article_id == ^article_id,
             select: {revision, body}
           )
         ) do
      {%ArticleRevision{} = revision, %ArticleBodySnapshot{} = body} ->
        {:ok, build_review_content(revision, body)}

      nil ->
        {:error, ArticleErrorCat.article_not_found("public revision not found")}
    end
  end

  defp review_content(%ArticleRevision{} = revision) do
    case Repo.get(ArticleBodySnapshot, revision.body_snapshot_id) do
      %ArticleBodySnapshot{} = body -> {:ok, build_review_content(revision, body)}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp build_review_content(%ArticleRevision{} = revision, %ArticleBodySnapshot{} = body) do
    %{
      identity: "article-revision:#{revision.id}",
      body_hash: body.body_hash,
      title: revision.title || "",
      body: body.plain_text || "",
      images: review_images(revision.id)
    }
  end

  defp binding_community_ids(article_id) do
    ArticleBinding
    |> where([binding], binding.article_id == ^article_id)
    |> select([binding], binding.community_id)
    |> Repo.all()
  end

  defp lock_review_lifecycle(article_id) do
    Repo.one(
      from(lifecycle in ArticleLifecycle,
        where: lifecycle.article_id == ^article_id,
        lock: "FOR UPDATE"
      )
    )
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

  defp lock_article(article_id) do
    Article
    |> where([article], article.id == ^article_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
    |> case do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp binding_context(article, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community -> Bindings.get(article, community)
      nil -> binding_context_by_id(article, Keyword.get(opts, :community_id))
      _ -> {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp binding_context_by_id(article, nil) do
    Bindings.get(article, Map.get(article, :community))
  end

  defp binding_context_by_id(article, community_id) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{} = community -> Bindings.get(article, community)
      _ -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  defp binding_context_by_id(_article, _community_id) do
    {:error, ArticleErrorCat.binding_context_required()}
  end

  defp ensure_binding(%Article{} = article, %Community{id: community_id}) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: community_id) do
      %ArticleBinding{} = binding -> {:ok, binding}
      nil -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  defp validate_version(version, version), do: {:ok, :pass}
  defp validate_version(_actual, _expected), do: {:error, :draft_version_conflict}
  defp validate_lifecycle_version(version, version), do: {:ok, :pass}
  defp validate_lifecycle_version(_actual, _expected), do: {:error, :lifecycle_version_conflict}

  defp sync_community_tags(%Article{} = article, %Community{} = community, opts) do
    case Keyword.fetch(opts, :community_tags) do
      :error ->
        {:ok, :pass}

      {:ok, tag_ids} ->
        case Assignment.overwrite(
               community,
               article.thread,
               article,
               %{community_tags: tag_ids},
               identity: community_tag_identity(opts)
             ) do
          {:ok, _article} -> {:ok, :pass}
          {:error, reason} -> {:error, reason}
        end
    end
  end

  defp community_tag_identity(opts) do
    case Keyword.get(opts, :outbox_command_id) do
      command_id when is_binary(command_id) ->
        case Ecto.UUID.cast(command_id) do
          {:ok, command_id} -> {:command, command_id}
          :error -> workflow_tag_identity(opts)
        end

      _ ->
        workflow_tag_identity(opts)
    end
  end

  defp workflow_tag_identity(opts) do
    case Keyword.get(opts, :outbox_workflow_ref) do
      workflow_ref when is_binary(workflow_ref) and workflow_ref != "" ->
        {:workflow, workflow_ref}

      _ ->
        nil
    end
  end

  defp ensure_active_at(%Article{active_at: %DateTime{}} = article, _published_at) do
    {:ok, article}
  end

  defp ensure_active_at(%Article{} = article, published_at) do
    article |> Article.changeset(%{active_at: published_at}) |> Repo.update()
  end

  defp changed_fields(_article, nil, _draft), do: []

  defp changed_fields(article, %ArticlePublic{} = public, draft) do
    revision = Repo.get!(CMS.Model.ArticleRevision, public.revision_id)

    Draft.Diff.publish_changed_fields(article, draft, revision)
  end
end
