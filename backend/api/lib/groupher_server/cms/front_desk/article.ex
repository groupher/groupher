defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves one public/management Article path and trusted internal Article views.

  Public reads accept a structured Article path and run the canonical Article
  Gate scope before returning a projection. Internal reads accept a stable ID
  only with `mode: :internal`; the `view` option controls the preload contract
  for trusted backend callers and does not grant public visibility.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> ArticlePath parse + Community/ArticleBinding lookup
        -> Gate Scope or trusted internal view
        -> ArticleView / stable Article

  For example, a public caller uses `read(path, actor, mode: :public)`. A
  trusted command with a stable ID uses
  `read(id, nil, mode: :internal, view: :command_context)`.
  """

  require GroupherServer.CMS.Docs.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Communities.Enable
  alias CMS.FrontDesk.Community, as: CommunityFrontDesk
  alias CMS.Gate.Context.Scope.Article, as: ArticleScopeContext
  alias CMS.Gate.Context.Scope.Doc, as: DocScopeContext
  alias CMS.ArticlePath

  alias CMS.Model.{
    Article,
    ArticlePublic,
    ArticleRevision,
    Community,
    DocPublic
  }

  alias Helper.ORM

  @doc """
  Reads one Article from a public path or a trusted internal ID.

  Public paths are parsed and authorized through Gate before a projection is
  returned. Stable IDs require `mode: :internal`; `view` selects a backend
  preload contract and does not change public visibility.

  ## Examples

      FrontDesk.Article.read(article_path, actor, mode: :public)
      FrontDesk.Article.read(article_id, nil, mode: :internal, view: :command_context)
  """
  @spec read(ArticlePath.t() | String.t(), term(), keyword()) ::
          {:ok, struct()} | {:error, map()}
  def read(article_id, nil, opts) when is_binary(article_id) and is_list(opts) do
    case Keyword.get(opts, :mode, :public) do
      :internal -> read_internal(article_id, Keyword.get(opts, :view, :default))
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  def read(article_path, actor, opts) do
    case {Keyword.get(opts, :mode, :public), Keyword.get(opts, :view, :default)} do
      {mode, :default} when mode in [:public, :management] ->
        with {:ok, %{community: community, thread: thread, inner_id: inner_id}} <-
               ArticlePath.parse(article_path),
             {:ok, community} <- CommunityFrontDesk.read(community, actor, opts) do
          with {:ok, _thread} <- Enable.thread?(community.slug, thread) do
            read_stable(community, thread, inner_id, actor, opts)
          end
        end

      _mode_and_view ->
        {:error, ArticleErrorCat.article_not_found("unsupported Article read mode/view")}
    end
  end

  defp read_internal(article_id, view)
       when view in [:default, :with_community, :with_author, :command_context] do
    preload =
      case view do
        :default -> []
        :with_community -> []
        :with_author -> [author: :user]
        :command_context -> [author: :user]
      end

    ORM.find(Article, article_id, preload: preload)
  end

  defp read_internal(_article_id, _view) do
    {:error, ArticleErrorCat.article_not_found("unsupported Article read view")}
  end

  @doc """
  Reads a public stable Article projection from its external ArticlePath coordinates.

  The caller must provide the already-resolved Community. This function still
  applies the matching Gate scope and returns `article_not_found` for an
  unavailable path; stable IDs alone do not grant public visibility.

  ## Examples

      FrontDesk.Article.read_stable(community, :post, inner_id, actor, [])
  """
  @spec read_stable(Community.t(), atom(), integer() | String.t(), term(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def read_stable(%Community{} = community, thread, inner_id, actor, opts) do
    with {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         %Article{} = article <- stable_article(community, thread, inner_id, actor, opts),
         {:ok, projection} <- stable_public_projection(article, community) do
      {:ok, projection}
    else
      nil -> {:error, ArticleErrorCat.article_not_found("article not found")}
      :error -> {:error, ArticleErrorCat.article_not_found("article not found")}
      {:error, _reason} = error -> error
    end
  end

  defp stable_article(%Community{} = community, thread, inner_id, actor, opts) do
    policy_mode =
      if Keyword.get(opts, :mode, :public) == :management, do: :owner_management, else: :public

    context =
      if thread == :doc do
        DocScopeContext.public_main(policy_mode: policy_mode)
      else
        ArticleScopeContext.public(thread, policy_mode: policy_mode)
      end

    with %Ecto.Query{} = query <- CMS.Gate.scope(Article, actor, :read, context) do
      query
      |> where(
        [gate_article_binding: binding, gate_community: scoped_community],
        scoped_community.id == ^community.id and binding.inner_id == ^inner_id
      )
      |> preload([article, ...], author: :user)
      |> select([article, ...], article)
      |> Repo.one()
    end
  end

  defp stable_public_projection(%Article{thread: :doc} = article, community) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: community.id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %DocPublic{} = public <-
           Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id),
         %CMS.Model.DocBranchVersion{} = version <-
           Repo.get(CMS.Model.DocBranchVersion, public.branch_version_id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, version.revision_id) do
      CMS.Articles.RevisionProjection.build_stable(
        article,
        community,
        public,
        revision,
        branch_id
      )
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_public_projection(%Article{} = article, community) do
    with %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id) do
      CMS.Articles.RevisionProjection.build_stable(article, community, public, revision, nil)
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end
end
