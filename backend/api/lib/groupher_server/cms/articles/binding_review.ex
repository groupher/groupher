defmodule GroupherServer.CMS.Articles.BindingReview do
  @moduledoc """
  Builds or ends review state from the selected immutable Article Snapshot.

      Article binding change -> current Public-selected Snapshot -> review request

  Gate admission and post-commit effects remain at the authenticated command
  boundary; this module owns the atomic persistence transition.
  """

  import Ecto.Query

  alias GroupherServer.CMS

  alias GroupherServer.{AlertWall, CMS, Repo, ReviewBot}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias CMS.Model.{
    Article,
    ArticleAssetRef,
    ArticleLifecycle,
    ArticleSnapshot,
    ArticlePublic,
    Community,
    CommunityAsset
  }

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
           ),
         {:ok, :pass} <-
           AlertWall.resolve_target_in_transaction(
             %{
               owner: :cms,
               target_type: :article,
               target_id: article.id,
               community_id: community_id
             },
             "binding_removed",
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

  defp register_published_binding_review(article, community, lifecycle, operation_ref) do
    with {:ok, configs} <- ReviewBot.configs(community.id, :article),
         {:ok, content} <- current_review_content(article.id),
         target <- %{
           type: :article,
           article_id: article.id,
           lifecycle: lifecycle,
           operation_ref: operation_ref
         },
         {:ok, _registered} <-
           CMS.Review.RequestSubmission.register_in_transaction(
             target,
             content,
             configs,
             :binding,
             {:community, community.id}
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
             join: snapshot in ArticleSnapshot,
             on: snapshot.id == public.snapshot_id and snapshot.article_id == public.article_id,
             where: public.article_id == ^article_id,
             select: snapshot
           )
         ) do
      %ArticleSnapshot{} = snapshot ->
        {:ok, build_review_content(snapshot)}

      nil ->
        {:error, ArticleErrorCat.article_not_found("public snapshot not found")}
    end
  end

  defp build_review_content(%ArticleSnapshot{} = snapshot) do
    %{
      identity: "article-snapshot:#{snapshot.id}",
      title: snapshot.title || "",
      body: CMS.Articles.Body.document(snapshot).plain_text || "",
      images: review_images(snapshot.id)
    }
  end

  defp lock_review_lifecycle(article_id) do
    Repo.one(
      from(lifecycle in ArticleLifecycle,
        where: lifecycle.article_id == ^article_id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp review_images(snapshot_id) do
    ArticleAssetRef
    |> join(:inner, [ref], asset in CommunityAsset, on: asset.id == ref.asset_id)
    |> where(
      [ref, asset],
      ref.snapshot_id == ^snapshot_id and ref.usage in [:inline, :cover, :cover_dark] and
        asset.asset_type == :image
    )
    |> order_by([ref, _asset], asc: ref.position, asc: ref.id)
    |> select([ref, asset], %{
      asset_id: ref.asset_id,
      immutable_version: fragment("COALESCE(?, ?)", asset.content_hash, asset.url_hash)
    })
    |> Repo.all()
  end
end
