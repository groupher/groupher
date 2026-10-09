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

  alias GroupherServer.{CMS, Repo}
  alias CMS.ErrorCat

  alias CMS.Seeds.{Articles, Communities, Config, Tags}

  alias CMS.Model.{
    Community,
    Article
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
    with {:ok, community} <- ORM.find_by(Community, %{slug: to_string(slug)}),
         article_ids <-
           Repo.all(
             from(binding in CMS.Model.ArticleBinding,
               where: binding.community_id == ^community.id,
               select: binding.article_id
             )
           ),
         {_count, _} <- delete_all(from(article in Article, where: article.id in ^article_ids)),
         {:ok, _community} <- Repo.delete(community, timeout: 300_000) do
      {:ok, :ok}
    end
  end

  defp seed_threads(community, opts) do
    tag_count_range = Keyword.get(opts, :tag_count_range, @tag_count_range)

    article_count_per_thread =
      Keyword.get(opts, :article_count_per_thread, @article_count_per_thread)

    comment_count_range =
      case Keyword.get(opts, :comment_count_range) do
        {min, max} when is_integer(min) and is_integer(max) and min <= max ->
          {min, max}

        _ ->
          comment_count_per_article = Keyword.get(opts, :comment_count_per_article)

          case comment_count_per_article do
            count when is_integer(count) and count >= 0 -> {count, count}
            _ -> @comment_count_range
          end
      end

    article_upvotes_range = Keyword.get(opts, :article_upvotes_range, @article_upvotes_range)
    comment_upvotes_range = Keyword.get(opts, :comment_upvotes_range, @comment_upvotes_range)
    comment_replies_range = Keyword.get(opts, :comment_replies_range, @comment_replies_range)

    tags_by_thread =
      Enum.reduce(@tag_threads, %{}, fn thread, acc ->
        {:ok, tag_ids} = Tags.mock(community, thread, count: random_range(tag_count_range))
        Map.put(acc, thread, tag_ids)
      end)

    posts =
      Enum.reduce(@content_threads, [], fn thread, acc ->
        {:ok, articles} =
          Articles.mock(
            community,
            thread,
            count_range: {article_count_per_thread, article_count_per_thread},
            upvotes_range: article_upvotes_range,
            comment_range: comment_count_range,
            comment_upvotes_range: comment_upvotes_range,
            replies_range: comment_replies_range,
            tag_ids: Map.get(tags_by_thread, thread, [])
          )

        case thread do
          :post -> acc ++ articles
          _ -> acc
        end
      end)

    {:ok, posts}
  end

  defp seed_post_states_and_cats(%Community{} = community, posts) when is_list(posts) do
    post_modes =
      posts
      |> Enum.shuffle()
      |> Enum.with_index()
      |> Enum.map(fn {_post, idx} ->
        case idx do
          0 -> :none
          1 -> :cat_only
          2 -> :cat_and_state
          _ -> Enum.random([:none, :cat_and_state, :cat_and_state, :cat_only])
        end
      end)

    posts
    |> Enum.zip(post_modes)
    |> Enum.reduce_while({:ok, :ok}, fn {post, mode}, _acc ->
      post = Repo.get!(Article, post.id)

      case mode do
        :none ->
          {:cont, {:ok, :ok}}

        :cat_only ->
          case CMS.Articles.States.set_cat(post, Enum.random(@post_cats)) do
            {:ok, _} -> {:cont, {:ok, :ok}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        :cat_and_state ->
          with {:ok, post} <- CMS.Articles.States.set_cat(post, Enum.random(@post_cats)),
               {:ok, _post} <-
                 CMS.Articles.States.set_status(post, Enum.random(@post_statuses), community.id) do
            {:cont, {:ok, :ok}}
          else
            {:error, reason} -> {:halt, {:error, reason}}
          end
      end
    end)
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
