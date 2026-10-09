defmodule GroupherServer.CMS.Articles.Publish.Target do
  @moduledoc """
  Executes the stable Article Draft-to-Revision publication transaction.

      stable Article lock -> Draft -> Revision -> Public -> delete Draft

  Gate admission and post-commit effects remain at the authenticated command
  boundary; this module owns the atomic persistence transition.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Bindings, Draft, Draft.Store, Lifecycle, Numbering, Public, Revision}
  alias CMS.Articles.Tags.Assignment
  alias CMS.Model.{Article, ArticleBinding, ArticlePublic, Author, Community}

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
      Repo.transaction(fn ->
        with {:ok, locked_article} <- lock_article(article.id),
             {:ok, draft} <- Store.get_for_update(locked_article),
             {:ok, _} <- validate_version(draft.version, expected_version),
             {:ok, lifecycle} <- Lifecycle.lock(locked_article),
             {:ok, _} <- validate_lifecycle_version(lifecycle.version, expected_lifecycle_version),
             {:ok, _} <- sync_community_tags(locked_article, community, opts),
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
             {:ok, _lifecycle} <- Lifecycle.transition(lifecycle, :published),
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
      _ -> {:error, :article_binding_context_required}
    end
  end

  defp binding_context_by_id(article, nil),
    do: Bindings.get(article, Map.get(article, :community))

  defp binding_context_by_id(article, community_id) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{} = community -> Bindings.get(article, community)
      _ -> {:error, :article_binding_not_found}
    end
  end

  defp binding_context_by_id(_article, _community_id),
    do: {:error, :article_binding_context_required}

  defp ensure_binding(%Article{} = article, %Community{id: community_id}) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: community_id) do
      %ArticleBinding{} = binding -> {:ok, binding}
      nil -> {:error, :article_binding_not_found}
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
