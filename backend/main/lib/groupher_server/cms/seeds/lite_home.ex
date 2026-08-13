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
  alias GroupherServer.CMS.Seeds.{Communities, FullCommunity}
  alias GroupherServer.CMS.Seeds.Helper, as: SeedHelper
  alias CMS.Model.{Changelog, Community, Doc, Post}
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

  @spec seed(keyword()) :: T.domain_res(Community.t())
  def seed(opts \\ []) when is_list(opts) do
    reset? = Keyword.get(opts, :reset, false)

    with {:ok, :ok} <- maybe_reset(reset?),
         {:ok, community} <- Communities.mock(@slug, title: "Home"),
         {:ok, _} <- configure_dashboard(community),
         {:ok, _posts} <- seed_posts(community),
         {:ok, _} <- seed_changelogs(community),
         {:ok, community} <- CMS.Communities.read(@slug, inc_views: false) do
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
           CMS.Dashboard.update(community, :enable, %{
             about: true,
             about_techstack: true,
             about_location: true,
             about_links: true,
             about_media_report: true,
             post: true,
             changelog: true,
             kanban: true,
             doc: false
           }),
         {:ok, _} <-
           CMS.Dashboard.update(community, :base_info, %{
             title: "Home",
             slug: @slug,
             desc: "Minimal Groupher smoke-test community",
             homepage: "https://groupher.com",
             introduction: "A small seed dataset for validating Main and Dashboard routes.",
             city: "Shanghai,Singapore",
             techstack: "Elixir,Phoenix,PostgreSQL,TypeScript,React"
           }) do
      {:ok, :ok}
    end
  end

  defp seed_posts(%Community{} = community) do
    with {:ok, posts} <- seed_articles(community, :post, @post_titles),
         {:ok, posts} <- set_kanban_statuses(posts) do
      {:ok, posts}
    end
  end

  defp seed_changelogs(%Community{} = community) do
    seed_articles(community, :changelog, @changelog_titles)
  end

  defp seed_articles(%Community{} = community, thread, titles)
       when thread in [:post, :changelog] do
    schema = schema_for(thread)
    existing_articles = existing_articles_by_title(schema, thread, community.id, titles)

    with {:ok, author} <- SeedHelper.seed_bot() do
      titles
      |> Enum.reduce_while({:ok, []}, fn title, {:ok, acc} ->
        case Map.fetch(existing_articles, title) do
          {:ok, article} ->
            {:cont, {:ok, [article | acc]}}

          :error ->
            attrs = mock_attrs(thread, %{community_id: community.id, title: title})

            case CMS.Articles.create(community, thread, attrs, author) do
              {:ok, article} -> {:cont, {:ok, [article | acc]}}
              {:error, reason} -> {:halt, {:error, reason}}
            end
        end
      end)
      |> case do
        {:ok, articles} -> {:ok, Enum.reverse(articles)}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp schema_for(:post), do: Post
  defp schema_for(:changelog), do: Changelog

  defp existing_articles_by_title(schema, thread, community_id, titles) do
    schema
    |> CMS.Articles.active_scope(thread)
    |> join(:inner, [item], community in assoc(item, :communities))
    |> where([item, community], community.id == ^community_id and item.title in ^titles)
    |> Repo.all()
    |> Map.new(&{&1.title, &1})
  end

  defp set_kanban_statuses(posts) do
    posts
    |> Enum.zip(Stream.cycle(@post_statuses))
    |> Enum.reduce_while({:ok, []}, fn {post, status}, {:ok, acc} ->
      case CMS.Articles.set_status(post, status) do
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
      posts: count(Post, :post, community_id),
      kanban_posts: count_kanban_posts(community_id),
      changelogs: count(Changelog, :changelog, community_id),
      docs: count(Doc, :doc, community_id)
    }
  end

  defp count_kanban_posts(community_id) do
    active_posts = CMS.Articles.active_scope(Post, :post)

    Repo.aggregate(
      from(post in active_posts,
        join: community in assoc(post, :communities),
        where: community.id == ^community_id and not is_nil(post.status)
      ),
      :count
    )
  end

  defp count(schema, thread, community_id) do
    active_articles = CMS.Articles.active_scope(schema, thread)

    Repo.aggregate(
      from(item in active_articles,
        join: community in assoc(item, :communities),
        where: community.id == ^community_id
      ),
      :count
    )
  end
end
