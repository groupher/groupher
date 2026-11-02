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
  alias CMS.Communities.Tags.Maintenance
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, ArticlePublic, Community, TicketState}
  alias CMS.Seeds.{Communities, FullCommunity, Tags, Wallpaper}
  alias CMS.Seeds.Helper, as: SeedHelper
  alias Helper.{ORM, T}

  @slug "home"
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
  @tag_count 5
  @tag_group_count 2

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
         {:ok, _} <- maybe_seed_wallpaper(community, opts),
         {:ok, post_tag_ids} <- seed_tags(community, :post),
         {:ok, changelog_tag_ids} <- seed_tags(community, :changelog),
         {:ok, _posts} <- seed_posts(community, post_tag_ids),
         {:ok, _} <- seed_changelogs(community, changelog_tag_ids),
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

  defp maybe_seed_wallpaper(%Community{} = community, opts) do
    if Keyword.get(opts, :wallpaper, true) do
      Wallpaper.seed(community, Keyword.get(opts, :wallpaper_opts, []))
    else
      {:ok, :skipped}
    end
  end

  defp seed_tags(%Community{} = community, thread) do
    Tags.mock(community, thread, count: @tag_count, group_count: @tag_group_count)
  end

  defp seed_posts(%Community{} = community, tag_ids) when is_list(tag_ids) do
    seed_articles(community, :post, @post_titles, tag_ids)
  end

  defp seed_changelogs(%Community{} = community, tag_ids) when is_list(tag_ids) do
    seed_articles(community, :changelog, @changelog_titles, tag_ids)
  end

  defp seed_articles(%Community{} = community, thread, titles, tag_ids)
       when thread in [:post, :changelog] do
    existing_articles = existing_articles_by_title(thread, community.id, titles)

    with {:ok, author} <- SeedHelper.seed_bot() do
      articles_result =
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

      case articles_result do
        {:ok, articles} -> ensure_article_tags(articles, tag_ids)
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

  defp ensure_article_tags(articles, tag_ids) when is_list(articles) and is_list(tag_ids) do
    tag_ids = Enum.take(tag_ids, 3)

    articles
    |> Enum.reduce_while({:ok, []}, fn article, {:ok, acc} ->
      case ensure_tags_for_article(article, tag_ids) do
        {:ok, article} -> {:cont, {:ok, [article | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, articles} -> {:ok, Enum.reverse(articles)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_tags_for_article(%{id: article_id}, tag_ids) when is_list(tag_ids) do
    article = Repo.get!(Article, article_id)

    tag_ids
    |> Enum.reduce_while({:ok, article}, fn tag_id, {:ok, article} ->
      workflow_ref = "seed-article-tags:#{article.id}:#{tag_id}"

      case Maintenance.add(article, tag_id, workflow_ref) do
        {:ok, article} -> {:cont, {:ok, article}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
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

  defp summary(%Community{id: community_id}) do
    %{
      slug: @slug,
      posts: count(:post, community_id),
      user_tickets: count_user_tickets(community_id),
      changelogs: count(:changelog, community_id),
      docs: count(:doc, community_id)
    }
  end

  defp count_user_tickets(community_id) do
    Repo.aggregate(
      from(ticket in TicketState,
        join: binding in ArticleBinding,
        on: binding.id == ticket.article_binding_id,
        join: lifecycle in ArticleLifecycle,
        on: lifecycle.article_id == ticket.article_id and lifecycle.thread == :ticket,
        where:
          binding.community_id == ^community_id and ticket.type == :user and
            lifecycle.state == :published
      ),
      :count,
      :article_id
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
