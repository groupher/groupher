defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public Article paths through typed Gate Scope and Article projection.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> Gate Scope / Repo
        -> Articles.Response
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Articles.Response
  alias CMS.Docs.Branch
  alias CMS.FrontDesk.Community, as: CommunityReader
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Helper.ArticlePath
  alias CMS.Model.Community
  alias Helper.ORM

  @doc "Reads one public Article from a structured path."
  @spec read(ArticlePath.t(), keyword()) :: {:ok, struct()} | {:error, map()}
  def read(article_path, opts) do
    with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
           ArticlePath.parse(article_path),
         {:ok, community} <- CommunityReader.read(community) do
      read(community, thread, inner_id, opts)
    end
  end

  @doc "Reads one public Article from canonical Community/thread/id coordinates."
  @spec read(Community.t(), atom(), integer() | String.t(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def read(%Community{id: community_id} = community, thread, inner_id, opts) do
    preload = Keyword.get(opts, :preload, [])

    with {:ok, info} <- match(thread),
         {:ok, scope_context} <- public_scope_context(community, thread, opts),
         %Ecto.Query{} = query <- CMS.Gate.scope(info.model, nil, :read, scope_context),
         {:ok, article} <-
           query
           |> where(
             [article],
             article.community_id == ^community_id and article.inner_id == ^inner_id
           )
           |> preload(^preload)
           |> Repo.one()
           |> done(),
         {:ok, article} <- ORM.fill_meta(article) do
      Response.one(article, nil)
    else
      {:error, _} -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp public_scope_context(%Community{} = community, :doc, opts) do
    with {:ok, branch} <- Branch.resolve(community, Branch.main_slug()) do
      {:ok,
       DocContext.public_branch(branch.id,
         include_illegal: Keyword.get(opts, :include_illegal, false)
       )}
    end
  end

  defp public_scope_context(_community, thread, opts),
    do:
      {:ok,
       ArticleContext.public(thread, include_illegal: Keyword.get(opts, :include_illegal, false))}

  defp done(nil), do: {:error, ErrorCat.custom(%{reason: :not_exist})}
  defp done(result), do: {:ok, result}
end
