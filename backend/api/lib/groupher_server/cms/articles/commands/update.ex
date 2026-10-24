defmodule GroupherServer.CMS.Articles.Commands.Update do
  @moduledoc """
  Updates and republishes one ordinary stable Article under one command receipt.

      loaded stable Article
        -> one Gate admission
        -> ensure/update Draft
        -> atomic Publish
        -> FrontDesk public DTO

  The command stores the stable UUID as its result key. Recovery reconstructs
  the current canonical public DTO instead of retaining a physical content row.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store, as: DraftStore
  alias CMS.Articles.{Bindings, RevisionProjection, RevisionResult}
  alias CMS.Articles.Store, as: ArticleStore
  alias CMS.FrontDesk
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, Community}
  alias CMS.Articles.Commands.RevisionConfirmation, as: Confirmation

  @doc "Updates and republishes one stable Article using optimistic content versioning."
  @spec execute(map() | Article.t(), map(), User.t(), Ecto.UUID.t()) ::
          {:ok, map()} | {:error, term()}
  def execute(article_or_projection, attrs, %User{} = user, command_id) do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %{community: %Community{} = community}} <-
           binding_context(article, article_or_projection) do
      execute_pipeline(
        article,
        community,
        Map.drop(attrs, [:command_id, :cur_user]),
        user,
        command_id
      )
    else
      {:error, _reason} = error -> error
    end
  end

  @pipeline operation: :article_update,
            confirmation: Confirmation,
            target: :article,
            params: [:attrs]

  receipt_pipeline execute_pipeline(article, community, attrs, user, command_id) do
    gate(fn candidate -> CMS.Gate.check_in_transaction(user, :edit, candidate, community) end)

    change(fn canonical ->
      with {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(user),
           {:ok, %{public: public}} <-
             update_and_publish(canonical, attrs, author, user, community, command_id),
           {:ok, %ArticleBinding{inner_id: inner_id}} when is_integer(inner_id) <-
             Bindings.fetch_binding(canonical.id, community.id) do
        with {:ok, revision_id} <- required_revision_id(public),
             {:ok, publication_version} <- required_publication_version(public),
             {:ok, published_at} <- required_published_at(public) do
          {:ok,
           %Confirmation{
             article_id: canonical.id,
             revision_id: revision_id,
             community_id: community.id,
             author_id: canonical.author_id,
             inner_id: inner_id,
             thread: canonical.thread,
             publication_version: publication_version,
             published_at: published_at,
             command_id: command_id
           }}
        else
          _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
        end
      end
    end)

    confirm(fn confirmation -> {:ok, confirmation} end)
    present(fn confirmation -> RevisionResult.build(confirmation, community) end)
  end

  defp required_revision_id(%{revision_id: revision_id})
       when is_binary(revision_id) and revision_id != "" do
    {:ok, revision_id}
  end

  defp required_revision_id(_), do: {:error, :missing_revision_id}

  defp required_publication_version(%{publication_version: value}) when is_integer(value) do
    {:ok, value}
  end

  defp required_publication_version(_), do: {:error, :missing_publication_version}

  defp required_published_at(%{inserted_at: %DateTime{} = value}), do: {:ok, value}
  defp required_published_at(_), do: {:error, :missing_published_at}

  defp update_and_publish(article, attrs, author, user, community, command_id) do
    result =
      with {:ok, lifecycle} <- load_lifecycle(article.id),
           {:ok, draft} <- DraftStore.ensure_from_public(article, author),
           {:ok, _} <- expected_version(attrs, draft.version),
           {:ok, updated} <-
             DraftStore.update_loaded(article, attrs, author, expected_version: draft.version),
           publish_opts =
             [
               expected_draft_version: updated.version,
               expected_lifecycle_version: lifecycle.version,
               community: community
             ] ++
               community_tag_opts(attrs) ++ [outbox_command_id: command_id],
           {:ok, publish_result} <-
             CMS.Articles.Workflow.publish(article, author, user, publish_opts),
           {:ok, public} <-
             RevisionProjection.build(
               publish_result.article,
               community,
               publish_result.revision,
               publication_version: publish_result.public.publication_version,
               published_at: publish_result.public.published_at
             ) do
        {:ok, %{public: public}}
      end

    case result do
      {:error, :draft_version_conflict} -> {:error, CMS.ErrorCat.draft_version_conflict()}
      other -> other
    end
  end

  defp expected_version(attrs, version) do
    case Map.get(attrs, :expected_version) do
      nil -> {:ok, :pass}
      ^version -> {:ok, :pass}
      _ -> {:error, :draft_version_conflict}
    end
  end

  defp load_lifecycle(article_id) do
    case ArticleStore.lifecycle(article_id) do
      {:ok, %ArticleLifecycle{} = lifecycle} -> {:ok, lifecycle}
      {:error, _reason} -> {:error, CMS.Articles.ErrorCat.lifecycle_not_found()}
    end
  end

  defp load_article(%Article{} = article), do: FrontDesk.article(article.id, mode: :internal)

  defp load_article(%{article_id: article_id}) when is_binary(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp binding_context(article, %{community: %Community{} = community}) do
    Bindings.get(article, community)
  end

  defp binding_context(article, _article_or_projection) do
    Bindings.get(article, Map.get(article, :community))
  end

  defp community_tag_opts(attrs) do
    cond do
      Map.has_key?(attrs, :community_tags) ->
        [community_tags: Map.get(attrs, :community_tags) || []]

      Map.has_key?(attrs, "community_tags") ->
        [community_tags: Map.get(attrs, "community_tags") || []]

      true ->
        []
    end
  end
end
