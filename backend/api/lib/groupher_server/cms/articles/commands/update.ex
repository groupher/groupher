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

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store
  alias CMS.Articles.RevisionResult
  alias CMS.Articles.Reader
  alias CMS.Articles.Publish.Effects
  alias CMS.Articles.Publish.Target
  alias CMS.Command
  alias CMS.FrontDesk
  alias CMS.Model.{Article, ArticleLifecycle, Community}
  alias CMS.Articles.Commands.RevisionConfirmation, as: Confirmation

  @doc "Updates and republishes one stable Article using optimistic content versioning."
  @spec update(map() | Article.t(), map(), User.t(), Ecto.UUID.t()) ::
          {:ok, map()} | {:error, term()}
  def update(article_or_projection, attrs, %User{} = user, command_id) do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %Community{} = community} <-
           FrontDesk.community(article.community_id, mode: :internal) do
      command = %Command{
        actor: user,
        command_id: command_id,
        operation: :article_update,
        target: article,
        params: Map.drop(attrs, [:command_id, :cur_user])
      }

      Command.execute(command,
        action: &update_action(&1, community),
        confirmation: Confirmation,
        present: &present_command_result(&1, &2, community)
      )
    else
      {:error, _reason} = error -> error
    end
  end

  defp update_action(
         %{actor: user, target: article, params: attrs, command_id: command_id},
         community
       ) do
    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
         {:ok, %{public: public, publish_result: publish_result}} <-
           update_and_publish(article, attrs, author, user, community) do
      with {:ok, revision_id} <- required_revision_id(public),
           {:ok, publication_version} <- required_publication_version(public),
           {:ok, published_at} <- required_published_at(public) do
        {:ok,
         %Confirmation{
           article_id: article.id,
           revision_id: revision_id,
           community_id: community.id,
           author_id: article.author_id,
           inner_id: article.inner_id,
           thread: article.thread,
           publication_version: publication_version,
           published_at: published_at,
           command_id: command_id
         }, %{article: publish_result.article, revision: publish_result.revision}}
      else
        _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end
  end

  defp required_revision_id(%{revision_id: revision_id})
       when is_binary(revision_id) and revision_id != "",
       do: {:ok, revision_id}

  defp required_revision_id(_), do: {:error, :missing_revision_id}

  defp required_publication_version(%{publication_version: value}) when is_integer(value),
    do: {:ok, value}

  defp required_publication_version(_), do: {:error, :missing_publication_version}

  defp required_published_at(%{inserted_at: %DateTime{} = value}), do: {:ok, value}
  defp required_published_at(_), do: {:error, :missing_published_at}

  defp update_and_publish(article, attrs, author, user, community) do
    CMS.Gate.Access.with_check(user, :edit, article, fn canonical ->
      with {:ok, lifecycle} <- lifecycle(canonical.id),
           {:ok, draft} <- Store.ensure_from_public(canonical, author),
           :ok <- expected_version(attrs, draft.version),
           {:ok, updated} <-
             Store.update(canonical, attrs, author, expected_version: draft.version),
           publish_opts =
             [
               expected_draft_version: updated.version,
               expected_lifecycle_version: lifecycle.version
             ] ++
               community_tag_opts(attrs),
           {:ok, %{article: published} = publish_result} <-
             Target.publish(canonical, author, publish_opts),
           {:ok, _effects} <- Effects.run(publish_result),
           {:ok, public} <- public_projection(published.id, community) do
        {:ok, %{public: public, publish_result: publish_result}}
      end
    end)
  end

  defp expected_version(attrs, version) do
    case Map.get(attrs, :expected_version) do
      nil -> :ok
      ^version -> :ok
      _ -> {:error, :draft_version_conflict}
    end
  end

  defp lifecycle(article_id) do
    case Reader.lifecycle(article_id) do
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

  defp public_projection(article_id, community) do
    with {:ok, %Article{inner_id: inner_id, thread: thread}} when is_integer(inner_id) <-
           FrontDesk.article(article_id, mode: :internal) do
      FrontDesk.article(%{
        community: community.slug,
        thread: thread,
        inner_id: inner_id
      })
    else
      _ -> {:error, CMS.Articles.ErrorCat.projection_not_updated()}
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

  defp present_command_result(
         %Confirmation{} = confirmation,
         %{
           state: :executed,
           action_context: %{article: article, revision: revision}
         },
         community
       ) do
    confirmation
    |> Map.from_struct()
    |> RevisionResult.build_from_action(%{article: article, revision: revision}, community)
  end

  defp present_command_result(%Confirmation{} = confirmation, %{state: :recovered}, _community),
    do: RevisionResult.build(Map.from_struct(confirmation))
end
