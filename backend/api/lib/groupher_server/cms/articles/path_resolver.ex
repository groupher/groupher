defmodule GroupherServer.CMS.Articles.PathResolver do
  @moduledoc """
  Resolves bounded public ArticlePath batches for Article-owned consumers.

  The resolver keeps one grouped query per Community/thread pair and never
  falls back to one FrontDesk Article read per input path.

  Business position:

      Article batch caller
        -> CMS.Articles.PathResolver
        -> grouped Gate-aware Article query
        -> bounded public Article projections
  """

  import Ecto.Query, warn: false

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
    DocBranchState,
    DocLifecycle,
    DocPublic
  }

  @doc "Resolves visible public Articles for a bounded set of structured paths."
  @spec resolve([ArticlePath.t()]) ::
          {:ok, [%{path: map(), article: struct()}]} | {:error, term()}
  def resolve(paths) when is_list(paths) do
    if length(paths) <= 100 do
      do_resolve(paths)
    else
      {:error, ArticleErrorCat.article_not_found("too many article paths")}
    end
  end

  defp do_resolve(paths) do
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
          |> Enum.reduce(acc, fn article, group_acc ->
            Map.put(group_acc, {community_ref, thread, article.inner_id}, article)
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
         nil -> []
         article -> [%{path: path, article: article}]
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
      join: relation in ArticleCommunity,
      on: relation.article_id == article.id,
      join: branch in CMS.Model.DocBranch,
      on: branch.community_id == article.community_id and branch.type == :main,
      join: lifecycle in DocLifecycle,
      on: lifecycle.article_id == article.id and lifecycle.branch_id == branch.id,
      join: state in DocBranchState,
      on: state.article_id == article.id and state.branch_id == branch.id,
      join: public in DocPublic,
      on: public.article_id == article.id and public.branch_id == branch.id,
      where:
        relation.community_id == ^community_id and relation.visible == true and
          article.thread == :doc and article.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and state.moderation_state == :legal and
          public.visible == true,
      select: %{article: article, branch_id: branch.id}
    )
    |> Repo.all()
    |> Enum.map(&Map.put(&1.article, :branch_id, &1.branch_id))
  end

  defp public_articles(community_id, thread, inner_ids) do
    from(article in Article,
      join: relation in ArticleCommunity,
      on: relation.article_id == article.id,
      join: lifecycle in ArticleLifecycle,
      on: lifecycle.article_id == article.id,
      join: public in ArticlePublic,
      on: public.article_id == article.id,
      where:
        relation.community_id == ^community_id and relation.visible == true and
          article.thread == ^thread and article.inner_id in ^inner_ids and
          lifecycle.state in [:published, :archived] and article.moderation_state == :legal and
          public.visible == true,
      select: article
    )
    |> Repo.all()
  end
end
