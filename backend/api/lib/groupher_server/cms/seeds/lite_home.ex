defmodule GroupherServer.CMS.Seeds.LiteHome do
  @moduledoc """
  Minimal home community seed for production-like smoke tests.

  This seed keeps the dataset intentionally small so Cloudflare gateway smoke
  tests can exercise Main and Dashboard without loading the full demo corpus.

  Business position:

      Seed task
        -> LiteHome
        -> CMS context
        -> Repo
  """

  import Ecto.Query, warn: false
  import GroupherServer.Support.Factory

  alias GroupherServer.{CMS, Repo}

  alias CMS.Articles.Trash
  alias CMS.Model.{Article, ArticleBinding, ArticlePublic, Community, KanbanState}
  alias CMS.Seeds.{Communities, FullCommunity}
  alias CMS.Seeds.Helper, as: SeedHelper
  alias Helper.{ORM, T}

  @slug "home"
  @post_statuses [:todo, :wip, :done, :backlog]
  @post_titles [
    "一次线上故障复盘记录",
    "这个方案在生产可行吗",
    "从零搭建服务监控实践",
    "如何优化接口响应时间"
  ]
  @changelog_titles [
    "Cloudflare preview routing enabled",
    "Dashboard smoke-test data refreshed",
    "GraphQL endpoint verification notes"
  ]

  @doc """
  Seeds the minimal home community dataset.

  Pass `reset: true` to delete the existing home community first. Returns the
  fetched community with a `seed_summary` of per-thread counts.

  ## Examples

      CMS.Seeds.LiteHome.seed()

      CMS.Seeds.LiteHome.seed(reset: true)

  """
  @spec seed(keyword()) :: T.domain_res(Community.t())
  def seed(opts \\ []) when is_list(opts) do
    reset? = Keyword.get(opts, :reset, false)

    with {:ok, :ok} <- maybe_reset(reset?),
         {:ok, community} <- Communities.mock(@slug, title: "Home"),
         {:ok, _} <- configure_dashboard(community),
         {:ok, _posts} <- seed_posts(community),
         {:ok, _} <- seed_changelogs(community),
         {:ok, community} <- CMS.Communities.fetch(@slug, inc_views: false) do
      {:ok, Map.put(community, :seed_summary, summary(community))}
    end
  end

  @spec reset_and_seed(keyword()) :: T.domain_res(Community.t())
  def reset_and_seed(opts \\ []) when is_list(opts), do: seed(Keyword.put(opts, :reset, true))

  defp maybe_reset(true) do
    case ORM.find_by(Community, %{slug: @slug}) do
      {:ok, _community} -> FullCommunity.delete(@slug)
      {:error, _} -> {:ok, :ok}
    end
  end

  defp maybe_reset(false), do: {:ok, :ok}

  defp configure_dashboard(%Community{} = community) do
    with {:ok, _} <-
           CMS.Dashboard.update(
             community,
             :enable,
             %{
               about: true,
               about_techstack: true,
               about_location: true,
               about_links: true,
               about_media_report: true,
               post: true,
               changelog: true,
               kanban: true,
               doc: false
             },
             :operations,
             Ecto.UUID.generate()
           ),
         {:ok, _} <-
           CMS.Dashboard.update(
             community,
             :base_info,
             %{
               title: "Home",
               slug: @slug,
               desc: "Minimal Groupher smoke-test community",
               homepage: "https://groupher.com",
               introduction: "A small seed dataset for validating Main and Dashboard routes.",
               city: "Shanghai,Singapore",
               techstack: "Elixir,Phoenix,PostgreSQL,TypeScript,React"
             },
             :operations,
             Ecto.UUID.generate()
           ) do
      {:ok, :ok}
    end
  end

  defp seed_posts(%Community{} = community) do
    with {:ok, posts} <- seed_articles(community, :post, @post_titles) do
      set_kanban_statuses(community, posts)
    end
  end

  defp seed_changelogs(%Community{} = community) do
    seed_articles(community, :changelog, @changelog_titles)
  end

  defp seed_articles(%Community{} = community, thread, titles)
       when thread in [:post, :changelog] do
    existing_articles = existing_articles_by_title(thread, community.id, titles)

    with {:ok, author} <- SeedHelper.seed_bot() do
      titles
      |> Enum.reduce_while({:ok, []}, fn title, {:ok, acc} ->
        case Map.fetch(existing_articles, title) do
          {:ok, article} ->
            {:cont, {:ok, [article | acc]}}

          :error ->
            seed_new_article(community, thread, title, author, acc)
        end
      end)
      |> case do
        {:ok, articles} -> {:ok, Enum.reverse(articles)}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp seed_new_article(community, thread, title, author, acc) do
    attrs = mock_attrs(thread, %{community_id: community.id, title: title})

    case CMS.Articles.create(community, thread, attrs, author) do
      {:ok, article} -> {:cont, {:ok, [article | acc]}}
      {:error, reason} -> {:halt, {:error, reason}}
    end
  end

  defp existing_articles_by_title(thread, community_id, titles) do
    Article
    |> Trash.not_trashed_scope(thread)
    |> join(:inner, [article], binding in CMS.Model.ArticleBinding,
      on: binding.article_id == article.id
    )
    |> join(:inner, [article, _binding], public in ArticlePublic,
      on: public.article_id == article.id
    )
    |> where(
      [article, binding, public],
      binding.community_id == ^community_id and article.thread == ^thread and
        public.title in ^titles
    )
    |> select([article, _binding, public], %{
      id: article.id,
      thread: article.thread,
      title: public.title
    })
    |> Repo.all()
    |> Map.new(&{&1.title, &1})
  end

  defp set_kanban_statuses(%Community{} = community, posts) do
    posts
    |> Enum.zip(Stream.cycle(@post_statuses))
    |> Enum.reduce_while({:ok, []}, fn {post, status}, {:ok, acc} ->
      post = Repo.get!(Article, post.id)

      case CMS.Articles.States.set_status(post, status, community.id) do
        {:ok, post} -> {:cont, {:ok, [post | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, posts} -> {:ok, Enum.reverse(posts)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp summary(%Community{id: community_id}) do
    %{
      slug: @slug,
      posts: count(:post, community_id),
      kanban_posts: count_kanban_posts(community_id),
      changelogs: count(:changelog, community_id),
      docs: count(:doc, community_id)
    }
  end

  defp count_kanban_posts(community_id) do
    active_posts = Trash.not_trashed_scope(Article, :post)

    Repo.aggregate(
      from(post in active_posts,
        join: binding in ArticleBinding,
        on: binding.article_id == post.id,
        join: state in KanbanState,
        on: state.article_binding_id == binding.id,
        where: binding.community_id == ^community_id and post.thread == :post
      ),
      :count
    )
  end

  defp count(thread, community_id) do
    active_articles = Trash.not_trashed_scope(Article, thread)

    Repo.aggregate(
      from(item in active_articles,
        join: binding in ArticleBinding,
        on: binding.article_id == item.id,
        where: binding.community_id == ^community_id and item.thread == ^thread
      ),
      :count
    )
  end
end
