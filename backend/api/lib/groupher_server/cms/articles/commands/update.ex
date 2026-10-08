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

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store, as: DraftStore
  alias CMS.Articles.Bindings
  alias CMS.Articles.RevisionResult
  alias CMS.Articles.Store, as: ArticleStore
  alias CMS.Articles.Publish.Effects
  alias CMS.Articles.Publish.Target
  alias CMS.Command
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
      command = %Command{
        actor: user,
        command_id: command_id,
        operation: :article_update,
        target: article,
        params: Map.drop(attrs, [:command_id, :cur_user])
      }

      with {:ok, %Confirmation{} = confirmation} <-
             Command.execute(
               command,
               action: &update_action(&1, community),
               confirmation: Confirmation
             ) do
        RevisionResult.build(confirmation, community)
      end
    else
      {:error, _reason} = error -> error
    end
  end

  defp update_action(
         %{actor: user, target: article, params: attrs, command_id: command_id},
         community
       ) do
    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
         {:ok, %{public: public}} <-
           update_and_publish(article, attrs, author, user, community),
         %ArticleBinding{inner_id: inner_id} when is_integer(inner_id) <-
           Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id) do
      with {:ok, revision_id} <- required_revision_id(public),
           {:ok, publication_version} <- required_publication_version(public),
           {:ok, published_at} <- required_published_at(public) do
        {:ok,
         %Confirmation{
           article_id: article.id,
           revision_id: revision_id,
           community_id: community.id,
           author_id: article.author_id,
           inner_id: inner_id,
           thread: article.thread,
           publication_version: publication_version,
           published_at: published_at,
           command_id: command_id
         }}
      else
        _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end
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

  defp update_and_publish(article, attrs, author, user, community) do
    CMS.Gate.Access.with_community_check(user, :edit, community, article, fn canonical ->
      with {:ok, lifecycle} <- lifecycle(canonical.id),
           {:ok, draft} <- DraftStore.ensure_from_public(canonical, author),
           {:ok, _} <- expected_version(attrs, draft.version),
           {:ok, updated} <-
             DraftStore.update(canonical, attrs, author, expected_version: draft.version),
           publish_opts =
             [
               expected_draft_version: updated.version,
               expected_lifecycle_version: lifecycle.version,
               community: community
             ] ++
               community_tag_opts(attrs),
           {:ok, %{article: published} = publish_result} <-
             Target.publish(canonical, author, publish_opts),
           {:ok, _effects} <- Effects.run(publish_result),
           {:ok, public} <- public_projection(published.id, community) do
        {:ok, %{public: public}}
      end
    end)
  end

  defp expected_version(attrs, version) do
    case Map.get(attrs, :expected_version) do
      nil -> {:ok, :pass}
      ^version -> {:ok, :pass}
      _ -> {:error, :draft_version_conflict}
    end
  end

  defp lifecycle(article_id) do
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

  defp binding_context(article, _article_or_projection),
    do: Bindings.get(article, Map.get(article, :community))

  defp public_projection(article_id, community) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{thread: thread}} ->
        case Repo.get_by(ArticleBinding, article_id: article_id, community_id: community.id) do
          %ArticleBinding{inner_id: inner_id} when is_integer(inner_id) ->
            FrontDesk.article(%{
              community: community.slug,
              thread: thread,
              inner_id: inner_id
            })

          _ ->
            {:error, CMS.Articles.ErrorCat.projection_not_updated()}
        end

      _ ->
        {:error, CMS.Articles.ErrorCat.projection_not_updated()}
    end
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
