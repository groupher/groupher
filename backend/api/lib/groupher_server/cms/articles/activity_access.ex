defmodule GroupherServer.CMS.Articles.ActivityAccess do
  @moduledoc """
  Resolves the canonical Article visible to an Activity reader.

      Activity reader -> Article ActivityAccess -> Gate scope -> canonical Article
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleWorkingCopy, Community}

  @doc "Resolves an Article or WorkingCopy under its corresponding read policy."
  def authorize_read(%ArticleWorkingCopy{article_id: article_id}, actor) do
    with %Article{} = article <- Repo.get(Article, article_id),
         {:ok, [%{community: %Community{} = community}]} <-
           CMS.Articles.Bindings.all(article),
         {:ok, _admitted} <-
           CMS.Articles.WorkingCopy.Access.access_check(actor, :edit, article, community) do
      {:ok, article}
    else
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("Article")}
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_activity_article_scope}
    end
  end

  def authorize_read(%Article{id: article_id, thread: :doc} = article, actor) do
    authorize_scoped(article_id, actor, :read, CMS.Gate.Context.Scope.Doc.public(), article)
  end

  def authorize_read(%Article{id: article_id, thread: thread} = article, actor) do
    authorize_scoped(
      article_id,
      actor,
      :read,
      CMS.Gate.Context.Scope.Article.public(thread),
      article
    )
  end

  def authorize_read(article, actor) do
    with thread when is_atom(thread) <- Map.get(article, :thread),
         article_id when is_binary(article_id) <-
           Map.get(article, :article_id) || Map.get(article, :id),
         {:ok, action, context} <- scope_context(article, thread) do
      authorize_scoped(article_id, actor, action, context, article)
    else
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_activity_article_scope}
    end
  end

  defp authorize_scoped(article_id, actor, action, context, article) do
    with %Ecto.Query{} = query <- CMS.Gate.scope(Article, actor, action, context),
         query <- scope_community(query, article),
         %Article{} = canonical <-
           query |> where([candidate], candidate.id == ^article_id) |> limit(1) |> Repo.one() do
      {:ok, canonical}
    else
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("Article")}
      {:error, _reason} = error -> error
    end
  end

  defp scope_community(query, %{community: %{id: id}}) when is_integer(id) do
    where(query, [gate_community: community], community.id == ^id)
  end

  defp scope_community(query, %{community: slug}) when is_binary(slug) do
    where(query, [gate_community: community], community.slug == ^slug or community.aka == ^slug)
  end

  defp scope_community(query, %{community_slug: slug}) when is_binary(slug) do
    where(query, [gate_community: community], community.slug == ^slug or community.aka == ^slug)
  end

  defp scope_community(query, _article), do: query

  defp scope_context(%{stage: :draft}, :doc) do
    {:ok, :read_draft, CMS.Gate.Context.Scope.Doc.draft(:owner)}
  end

  defp scope_context(%{stage: :public}, :doc) do
    {:ok, :read, CMS.Gate.Context.Scope.Doc.public()}
  end

  defp scope_context(%{stage: :public}, thread) do
    {:ok, :read, CMS.Gate.Context.Scope.Article.public(thread)}
  end

  defp scope_context(_article, _thread) do
    {:error, :invalid_activity_article_scope}
  end
end
