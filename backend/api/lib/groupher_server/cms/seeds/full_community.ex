defmodule GroupherServer.CMS.Seeds.FullCommunity do
  @moduledoc """
  End-to-end seed flow for a full demo community.

  It coordinates community, category, thread, article, and comment seeds for
  local environments that need realistic content.

  Business position:

      Seed task
        -> FullCommunity
        -> CMS context
        -> Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.ErrorCat

  alias CMS.Seeds.{Articles, Communities, Config, Tags}
  alias ReviewBot.Model.ReviewBotConfig

  alias CMS.Model.{
    Community,
    Article,
    AssetReplacementPlan,
    AssetUpload,
    AssetWorkflowRun
  }

  alias Helper.{ORM, T}

  @tag_threads Config.tag_threads()
  @content_threads Config.content_threads()
  @post_cats [:idea, :bug, :qa, :discussion]
  @post_statuses [:backlog, :todo, :wip, :done, :resolved, :reject]

  @tag_count_range Config.tag_count_range()
  @article_count_per_thread Config.article_count_per_thread()
  @comment_count_range Config.comment_count_range()
  @article_upvotes_range Config.article_upvotes_range()
  @comment_upvotes_range Config.comment_upvotes_range()
  @comment_replies_range Config.comment_replies_range()

  @doc """
  Seeds a complete demo community with default options.

  Delegates to `mock/2` with an empty keyword list.

  ## Examples

      CMS.Seeds.FullCommunity.mock("elixir")

  """
  @spec mock(String.t() | atom()) :: T.domain_res(map())
  def mock(slug), do: mock(slug, [])

  @spec mock(String.t() | atom(), keyword()) :: T.domain_res(map())
  def mock(slug, opts) when is_list(opts) do
    case Keyword.keyword?(opts) do
      true ->
        with {:ok, community} <- Communities.mock(slug),
             {:ok, _} <- seed_about_dashboard(community, slug),
             {:ok, posts} <- seed_threads(community, opts),
             {:ok, _} <- seed_post_states_and_cats(community, posts) do
          CMS.Communities.fetch(community.slug, inc_views: false)
        end

      false ->
        {:error, ErrorCat.custom("full_community mock opts must be a keyword list")}
    end
  end

  def mock(_slug, _opts) do
    {:error, ErrorCat.custom("full_community mock opts must be a keyword list")}
  end

  @spec delete(String.t() | atom()) :: T.domain_res(:ok)
  def delete(slug) do
    with {:ok, community} <- ORM.find_by(Community, %{slug: to_string(slug)}) do
      transaction_result =
        Repo.transaction(
          fn ->
            article_ids =
              Repo.all(
                from(binding in CMS.Model.ArticleBinding,
                  where: binding.community_id == ^community.id,
                  select: binding.article_id
                )
              )

            delete_all(
              from(plan in AssetReplacementPlan, where: plan.community_id == ^community.id)
            )

            delete_all(from(upload in AssetUpload, where: upload.community_id == ^community.id))
            delete_all(from(run in AssetWorkflowRun, where: run.community_id == ^community.id))
            delete_all(from(article in Article, where: article.id in ^article_ids))

            delete_all(
              from(config in ReviewBotConfig, where: config.community_id == ^community.id)
            )

            case Repo.delete(community, timeout: 300_000) do
              {:ok, _community} -> {:ok, :ok}
              {:error, reason} -> Repo.rollback(reason)
            end
          end,
          timeout: 300_000
        )

      case transaction_result do
        {:ok, {:ok, :ok}} -> {:ok, :ok}
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp seed_threads(community, opts) do
    tag_count_range = Keyword.get(opts, :tag_count_range, @tag_count_range)

    article_count_per_thread =
      Keyword.get(opts, :article_count_per_thread, @article_count_per_thread)

    comment_count_range = comment_count_range(opts)
    article_upvotes_range = Keyword.get(opts, :article_upvotes_range, @article_upvotes_range)
    comment_upvotes_range = Keyword.get(opts, :comment_upvotes_range, @comment_upvotes_range)
    comment_replies_range = Keyword.get(opts, :comment_replies_range, @comment_replies_range)

    tags_by_thread = seed_tags_by_thread(community, tag_count_range)

    article_opts = [
      count_range: {article_count_per_thread, article_count_per_thread},
      upvotes_range: article_upvotes_range,
      comment_range: comment_count_range,
      comment_upvotes_range: comment_upvotes_range,
      replies_range: comment_replies_range
    ]

    posts = seed_content_threads(community, tags_by_thread, article_opts)

    {:ok, posts}
  end

  defp comment_count_range(opts) do
    case Keyword.get(opts, :comment_count_range) do
      {min, max} when is_integer(min) and is_integer(max) and min <= max -> {min, max}
      _range -> fixed_or_default_comment_count(Keyword.get(opts, :comment_count_per_article))
    end
  end

  defp fixed_or_default_comment_count(count) when is_integer(count) and count >= 0 do
    {count, count}
  end

  defp fixed_or_default_comment_count(_count), do: @comment_count_range

  defp seed_tags_by_thread(community, tag_count_range) do
    Enum.reduce(@tag_threads, %{}, fn thread, acc ->
      {:ok, tag_ids} = Tags.mock(community, thread, count: random_range(tag_count_range))
      Map.put(acc, thread, tag_ids)
    end)
  end

  defp seed_content_threads(community, tags_by_thread, article_opts) do
    Enum.reduce(@content_threads, [], fn thread, posts ->
      opts = Keyword.put(article_opts, :tag_ids, Map.get(tags_by_thread, thread, []))
      {:ok, articles} = Articles.mock(community, thread, opts)
      collect_seed_posts(posts, thread, articles)
    end)
  end

  defp collect_seed_posts(posts, :post, articles), do: posts ++ articles
  defp collect_seed_posts(posts, _thread, _articles), do: posts

  defp seed_post_states_and_cats(%Community{} = community, posts) when is_list(posts) do
    post_modes =
      posts
      |> Enum.shuffle()
      |> Enum.with_index()
      |> Enum.map(fn {_post, idx} -> post_seed_mode(idx) end)

    posts
    |> Enum.zip(post_modes)
    |> Enum.reduce_while({:ok, :ok}, fn {post, mode}, _acc ->
      post = Repo.get!(Article, post.id)

      seed_post_state(post, mode, community)
    end)
  end

  defp post_seed_mode(0), do: :none
  defp post_seed_mode(1), do: :cat_only
  defp post_seed_mode(2), do: :cat_and_state
  defp post_seed_mode(_idx), do: Enum.random([:none, :cat_and_state, :cat_and_state, :cat_only])

  defp seed_post_state(_post, :none, _community), do: {:cont, {:ok, :ok}}

  defp seed_post_state(post, :cat_only, _community) do
    case CMS.Articles.States.set_cat(post, Enum.random(@post_cats)) do
      {:ok, _post} -> {:cont, {:ok, :ok}}
      {:error, reason} -> {:halt, {:error, reason}}
    end
  end

  defp seed_post_state(post, :cat_and_state, community) do
    with {:ok, post} <- CMS.Articles.States.set_cat(post, Enum.random(@post_cats)),
         {:ok, _post} <-
           CMS.Articles.States.set_status(post, Enum.random(@post_statuses), community.id) do
      {:cont, {:ok, :ok}}
    else
      {:error, reason} -> {:halt, {:error, reason}}
    end
  end

  defp seed_about_dashboard(community, slug) do
    slug = to_string(slug)

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
               doc: true
             },
             :operations,
             Ecto.UUID.generate()
           ),
         {:ok, _} <-
           CMS.Dashboard.update(
             community,
             :base_info,
             %{
               title: String.capitalize(slug),
               slug: slug,
               desc: "#{slug} community",
               homepage: "https://#{slug}.example.com",
               introduction: "Built with seed data for QA and showcase.",
               city: "Shanghai,Singapore,Berlin",
               techstack: "Elixir,Phoenix,PostgreSQL,TypeScript,React"
             },
             :operations,
             Ecto.UUID.generate()
           ),
         {:ok, _} <-
           CMS.Dashboard.update(
             community,
             :social_links,
             [
               %{type: "github", link: "https://github.com/#{slug}"},
               %{type: "twitter", link: "https://x.com/#{slug}"},
               %{type: "website", link: "https://#{slug}.example.com"}
             ],
             :operations,
             Ecto.UUID.generate()
           ),
         {:ok, _} <-
           CMS.Dashboard.update(
             community,
             :media_reports,
             [
               %{
                 index: 0,
                 title: "#{String.capitalize(slug)} announced",
                 site_name: "Groupher Weekly",
                 favicon: "https://groupher.com/favicon.ico",
                 url: "https://news.example.com/#{slug}/announce"
               },
               %{
                 index: 1,
                 title: "#{String.capitalize(slug)} product deep dive",
                 site_name: "Tech Radar",
                 favicon: "https://techradar.example.com/favicon.ico",
                 url: "https://techradar.example.com/#{slug}/deep-dive"
               }
             ],
             :operations,
             Ecto.UUID.generate()
           ) do
      {:ok, :ok}
    end
  end

  defp random_range({min, max}) when is_integer(min) and is_integer(max) and min <= max do
    Enum.random(min..max)
  end

  defp random_range(_), do: 10

  defp delete_all(query), do: Repo.delete_all(query, timeout: 300_000)
end
