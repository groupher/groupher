defmodule GroupherServer.CMS.Articles.Publish.Target do
  @moduledoc """
  Executes the stable Article Draft-to-Revision publication transaction.

      stable Article lock -> Draft -> Revision -> Public -> delete Draft

  Gate admission and post-commit effects remain at the authenticated command
  boundary; this module owns the atomic persistence transition.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.{Draft, Draft.Store, Lifecycle, Numbering, Public, Revision}
  alias CMS.Model.{Article, ArticleCommunity, ArticlePublic, Author, Community}

  @doc "Publishes one ordinary Draft after validating the caller-observed Draft version."
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

    Repo.transaction(fn ->
      with {:ok, locked_article} <- lock_article(article.id),
           {:ok, draft} <- Store.get_for_update(locked_article),
           :ok <- validate_version(draft.version, expected_version),
           {:ok, lifecycle} <- Lifecycle.lock(locked_article),
           :ok <- validate_lifecycle_version(lifecycle.version, expected_lifecycle_version),
           :ok <- sync_community_tags(locked_article, opts),
           current_public <- Repo.get(ArticlePublic, locked_article.id),
           first_publish? <- is_nil(current_public),
           changed_fields <- changed_fields(locked_article, current_public, draft),
           {:ok, relation} <- ensure_relation(locked_article),
           {:ok, relation} <- Numbering.assign_relation_inner_id(relation),
           locked_article <- %{locked_article | inner_id: relation.inner_id},
           {:ok, locked_article} <- ensure_active_at(locked_article, published_at),
           {:ok, revision} <- Revision.create(locked_article, draft),
           {:ok, public} <-
             Public.select(locked_article, revision, actor, published_at: published_at),
           :ok <- CMS.ArticleStats.initialize(locked_article),
           {:ok, _lifecycle} <- Lifecycle.transition(lifecycle, :published),
           :ok <- Store.delete_workspace(locked_article, draft) do
        %{
          article: locked_article,
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

  defp ensure_relation(%Article{} = article) do
    case Repo.get_by(ArticleCommunity, article_id: article.id, community_id: article.community_id) do
      %ArticleCommunity{} = relation -> {:ok, relation}
      nil -> {:error, :article_community_not_found}
    end
  end

  defp validate_version(version, version), do: :ok
  defp validate_version(_actual, _expected), do: {:error, :draft_version_conflict}
  defp validate_lifecycle_version(version, version), do: :ok
  defp validate_lifecycle_version(_actual, _expected), do: {:error, :lifecycle_version_conflict}

  defp sync_community_tags(%Article{} = article, opts) do
    case Keyword.fetch(opts, :community_tags) do
      :error ->
        :ok

      {:ok, tag_ids} ->
        community = Repo.get!(Community, article.community_id)

        case CMS.Communities.overwrite_tags(community, article.thread, article, %{
               community_tags: tag_ids
             }) do
          {:ok, _article} -> :ok
          {:error, reason} -> {:error, reason}
        end
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
