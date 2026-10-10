defmodule GroupherServer.CMS.FrontDesk.Article do
  @moduledoc """
  Resolves public/management Article paths, bounded public path batches, and
  trusted internal Article views.

  Business position:

      CMS.FrontDesk facade
        -> FrontDesk.Article
        -> ArticlePath parse + Community/ArticleBinding lookup
        -> Gate Scope, grouped public batch, or internal view
        -> ArticleView / stable Article
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
    ArticleBinding,
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

  @doc "Reads a bounded batch of visible public Articles from structured paths.

  Invalid, disabled, and non-visible paths are omitted in input order; the batch is
  capped at 100 paths and returns each resolved Article with its explicit binding."
  @spec read_many([ArticlePath.t()]) ::
          {:ok, [%{path: ArticlePath.t(), article: struct(), binding: ArticleBinding.t()}]}
          | {:error, map()}
  def read_many(paths) when is_list(paths) do
    if length(paths) <= 100 do
      do_read_many(paths)
    else
      {:error, ArticleErrorCat.article_not_found("too many article paths")}
    end
  end

  defp do_read_many(paths) do
    parsed =
      paths
      |> Enum.reduce([], fn path, acc ->
        case ArticlePath.parse(path) do
          {:ok, normalized} -> [normalized | acc]
          {:error, _} -> acc
        end
      end)
      |> Enum.reverse()

    resolved_by_path =
      parsed
      |> Enum.group_by(&{&1.community, &1.thread})
      |> Enum.reduce(%{}, fn {{community_ref, thread}, group}, acc ->
        with {:ok, community} <- CommunityFrontDesk.read(community_ref),
             {:ok, _thread} <- Enable.thread?(community.slug, thread) do
          inner_ids = Enum.map(group, &normalize_path_inner_id(&1.inner_id))

          community.id
          |> public_articles(thread, inner_ids)
          |> Enum.reduce(acc, fn %{inner_id: inner_id} = resolved, group_acc ->
            Map.put(group_acc, {community_ref, thread, inner_id}, resolved)
          end)
        else
          _ -> acc
        end
      end)

    {:ok,
     Enum.flat_map(parsed, fn path ->
       case Map.get(resolved_by_path, {
              path.community,
              path.thread,
              normalize_path_inner_id(path.inner_id)
            }) do
         nil ->
           []

         %{article: article, binding: binding} = resolved ->
           [
             %{
               path: path,
               article: article,
               binding: binding,
               branch_id: Map.get(resolved, :branch_id)
             }
           ]
       end
     end)}
  end

  defp normalize_path_inner_id(inner_id) when is_integer(inner_id), do: inner_id

  defp normalize_path_inner_id(inner_id) do
    case Integer.parse(to_string(inner_id)) do
      {value, ""} -> value
      _ -> -1
    end
  end

  defp public_articles(community_id, :doc, inner_ids) do
    from(article in Article,
      join: binding in ArticleBinding,
      on: binding.article_id == article.id,
      join: branch in CMS.Model.DocBranch,
      on: branch.community_id == ^community_id and branch.type == :main,
      join: lifecycle in DocLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == branch.id,
      join: state in DocBranchState,
      on: state.article_id == article.id and state.branch_id == branch.id,
      join: public in DocPublic,
      on: public.article_id == article.id and public.branch_id == branch.id,
      where:
        binding.community_id == ^community_id and binding.visible == true and
          article.thread == :doc and binding.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and state.moderation_state == :legal and
          public.visible == true,
      select: %{
        article: article,
        binding: binding,
        inner_id: binding.inner_id,
        branch_id: branch.id
      }
    )
    |> Repo.all()
  end

  defp public_articles(community_id, thread, inner_ids) do
    from(article in Article,
      join: binding in ArticleBinding,
      on: binding.article_id == article.id,
      join: lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id,
      join: public in ArticlePublic,
      on: public.article_id == article.id,
      where:
        binding.community_id == ^community_id and binding.visible == true and
          article.thread == ^thread and binding.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and article.moderation_state == :legal and
          public.visible == true,
      select: %{article: article, binding: binding, inner_id: binding.inner_id}
    )
    |> Repo.all()
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

  @doc "Reads a public stable Article projection from its external ArticlePath coordinates."
  @spec read_stable(Community.t(), atom(), integer() | String.t(), term(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def read_stable(%Community{} = community, thread, inner_id, actor, _opts) do
    with {inner_id, ""} <- Integer.parse(to_string(inner_id)),
         %Article{} = article <- stable_article(community.id, thread, inner_id),
         {:ok, _} <- stable_article_visible(article, community.id, actor),
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
    |> join(:inner, [article], binding in ArticleBinding, on: binding.article_id == article.id)
    |> where(
      [article, binding],
      article.thread == ^thread and binding.inner_id == ^inner_id and
        binding.community_id == ^community_id
    )
    |> preload([article, _binding], author: :user)
    |> select([article, _binding], article)
    |> Repo.one()
  end

  defp stable_article_visible(%Article{thread: :doc} = article, community_id, actor) do
    with %CMS.Model.DocBranch{id: branch_id} <-
           Repo.get_by(CMS.Model.DocBranch,
             community_id: community_id,
             type: CMS.Docs.Const.doc_branch_type(:main)
           ),
         %DocLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(DocLifecycle, article_id: article.id, branch_id: branch_id),
         %DocBranchState{} = branch_state <-
           Repo.get_by(DocBranchState, article_id: article.id, branch_id: branch_id) do
      if branch_state.moderation_state == :legal or article_owner?(article, actor) do
        {:ok, :pass}
      else
        {:error, ArticleErrorCat.pending("this article is under audition")}
      end
    else
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp stable_article_visible(%Article{moderation_state: :legal} = article, community_id, _actor) do
    with true <- article_binding_visible?(article.id, community_id),
         %ArticleLifecycle{state: state} when state in [:published, :archived] <-
           Repo.get_by(ArticleLifecycle, article_id: article.id) do
      {:ok, :pass}
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
      %ArticleLifecycle{state: state} when state in [:published, :archived] -> {:ok, :pass}
      _ -> {:error, ArticleErrorCat.article_not_found("article not found")}
    end
  end

  defp article_owner?(%Article{author: %{user_id: user_id}}, %{id: user_id}), do: true
  defp article_owner?(_article, _actor), do: false

  defp article_binding_visible?(article_id, community_id) do
    Repo.exists?(
      from(binding in ArticleBinding,
        where:
          binding.article_id == ^article_id and binding.community_id == ^community_id and
            binding.visible == true
      )
    )
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
