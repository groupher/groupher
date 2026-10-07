defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public/management Article paths and trusted internal Article views.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> Gate Scope or internal view
        -> Articles.Response / stable Article
  """

  import Ecto.Query, warn: false

  require GroupherServer.CMS.Docs.Const

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Communities.Enable
  alias CMS.FrontDesk.Community, as: CommunityFrontDesk
  alias CMS.Helper.ArticlePath

  alias CMS.Model.{
    Article,
    ArticleCommunity,
    ArticleLifecycle,
    ArticlePublic,
    ArticleRevision,
    Community,
    DocBranchState,
    DocLifecycle,
    DocPublic
  }

  alias Helper.ORM

  @doc "Reads one public Article from a structured path."
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
        :with_community -> [:community]
        :with_author -> [author: :user]
        :command_context -> [:community, author: :user]
      end

    ORM.find(Article, article_id, preload: preload)
  end

  defp read_internal(_article_id, _view) do
    {:error, ArticleErrorCat.article_not_found("unsupported Article read view")}
  end

  @doc "Reads a public stable Article projection from its external ArticlePath coordinates."
  @spec read_stable(Community.t(), atom(), integer() | String.t(), term(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def read_stable(%Community{} = community, thread, inner_id, actor, _opts) do
    with {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         %Article{} = article <- stable_article(community.id, thread, inner_id),
         :ok <- stable_article_visible(article, community.id, actor),
         {:ok, projection} <- stable_public_projection(article, community) do
      {:ok, projection}
    else
      nil -> {:error, :stable_article_not_found}
      :error -> {:error, :stable_article_not_found}
      {:error, _reason} = error -> error
    end
  end

  defp stable_article(community_id, thread, inner_id) do
    Article
    |> join(:inner, [article], relation in ArticleCommunity,
      on: relation.article_id == article.id
    )
    |> where(
      [article, relation],
      article.thread == ^thread and relation.inner_id == ^inner_id and
        relation.community_id == ^community_id
    )
    |> preload([article, _relation], author: :user)
    |> select([article, relation], %{article: article, inner_id: relation.inner_id})
    |> Repo.one()
    |> case do
      %{article: article, inner_id: inner_id} -> %{article | inner_id: inner_id}
      other -> other
    end
  end

  defp stable_article_visible(%Article{thread: :doc} = article, _community_id, actor) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: article.community_id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %DocLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(DocLifecycle, article_id: article.id, branch_id: branch_id),
         %DocBranchState{} = branch_state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      if branch_state.moderation_state == :legal or article_owner?(article, actor) do
        :ok
      else
        {:error, ArticleErrorCat.pending("this article is under audition")}
      end
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_article_visible(%Article{moderation_state: :legal} = article, community_id, _actor) do
    with true <- article_community_visible?(article.id, community_id),
         %ArticleLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(ArticleLifecycle, article_id: article.id) do
      :ok
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_article_visible(%Article{} = article, _community_id, actor) do
    if article_owner?(article, actor) do
      stable_article_lifecycle_visible(article)
    else
      {:error, ArticleErrorCat.pending("this article is under audition")}
    end
  end

  defp stable_article_lifecycle_visible(article) do
    case Repo.get_by(ArticleLifecycle, article_id: article.id) do
      %ArticleLifecycle{state: state} when state in [:published, :archived] -> :ok
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp article_owner?(%Article{author: %{user_id: user_id}}, %{id: user_id}), do: true
  defp article_owner?(_article, _actor), do: false

  defp article_community_visible?(article_id, community_id) do
    Repo.exists?(
      from(relation in ArticleCommunity,
        where:
          relation.article_id == ^article_id and relation.community_id == ^community_id and
            relation.visible == true
      )
    )
  end

  defp stable_public_projection(%Article{thread: :doc} = article, community) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: article.community_id,
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
