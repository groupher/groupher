defmodule GroupherServer.CMS.Articles.Commands.UpdateDraft do
  @moduledoc """
  Autosaves stable Article content with an optimistic Draft version guard.

      CMS.Articles.update_draft
        -> UpdateDraft.execute
        -> Gate -> Draft.Store.update
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat

  alias Accounts.Model.User
  alias CMS.Articles
  alias CMS.Articles.Draft.Store
  alias CMS.Model.{Article, Author, Community}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  @pipeline operation: :article_update_draft,
            target: :article_id,
            params: [:attrs, :opts]
  direct_pipeline execute_pipeline(article_id, attrs, actor, opts) do
    prepare(fn ->
      with {:ok, article} <- stable_article(article_id),
           {:ok, author} <- target_author(actor),
           {:ok, community} <- explicit_community(opts) do
        {:ok, %{article: article, author: author, community: community}}
      end
    end)

    gate(fn %{article: article, author: author, community: community} ->
      with {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor_user(actor), :edit, article, community) do
        {:ok, {canonical, author}}
      end
    end)

    change(fn {canonical, author} -> Store.update_loaded(canonical, attrs, author, opts) end)
  end

  @spec execute(Ecto.UUID.t(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, struct()} | {:error, term()}
  def execute(article_id, attrs, actor, opts) when is_binary(article_id) do
    execute_pipeline(article_id, attrs, actor, opts)
  end

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: Articles.Persist.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}

  defp actor_user(%User{} = user), do: user
  defp actor_user(%Author{user: %User{} = user}), do: user

  defp actor_user(%Author{user_id: user_id}) do
    case RootFrontDesk.fresh_user(user_id) do
      {:ok, user} -> user
      _ -> nil
    end
  end

  defp stable_article(article_id) do
    case CMS.FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end

  defp explicit_community(opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community -> {:ok, community}
      _ -> community_by_id(Keyword.get(opts, :community_id))
    end
  end

  defp community_by_id(community_id) when is_integer(community_id) do
    case CMS.FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      _ -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  defp community_by_id(_community_id), do: {:error, ArticleErrorCat.binding_context_required()}
end
