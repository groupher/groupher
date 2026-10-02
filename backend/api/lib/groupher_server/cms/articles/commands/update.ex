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
  alias CMS.Articles.Reader
  alias CMS.Articles.Publish.Effects
  alias CMS.Articles.Publish.Target
  alias CMS.Command
  alias CMS.Model.{Article, ArticleLifecycle, Community}

  @doc "Updates and republishes one stable Article using optimistic content versioning."
  @spec update(map() | Article.t(), map(), User.t(), Ecto.UUID.t()) ::
          {:ok, map()} | {:error, term()}
  def update(article_or_projection, attrs, %User{} = user, command_id) do
    with {:ok, article} <- load_article(article_or_projection),
         {:ok, %Community{} = community} <- Reader.community(article.community_id) do
      command = %Command{
        actor: user,
        command_id: command_id,
        operation: :article_update,
        target: article,
        params: Map.drop(attrs, [:command_id, :cur_user])
      }

      Command.execute(command,
        action: &update_action(&1, community),
        result: &recover_update(&1, article.id, community)
      )
    else
      {:error, _reason} = error -> error
    end
  end

  defp update_action(%{actor: user, target: article, params: attrs}, community) do
    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
         {:ok, public} <- update_and_publish(article, attrs, author, user, community) do
      {:ok, public, %{result_key: article.id}}
    end
  end

  defp recover_update(receipt, article_id, community) do
    with {:ok, public} <- public_projection(article_id, community) do
      {:ok, Map.put(public, :command_id, receipt.command_id)}
    end
  end

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
        {:ok, public}
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

  defp load_article(%Article{} = article), do: Reader.article(article.id)

  defp load_article(%{article_id: article_id}) when is_binary(article_id) do
    case Reader.article(article_id) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
    end
  end

  defp public_projection(article_id, community) do
    with {:ok, %Article{inner_id: inner_id, thread: thread}} when is_integer(inner_id) <-
           Reader.article(article_id) do
      CMS.FrontDesk.article(%{
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
end
