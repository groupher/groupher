defmodule GroupherServer.CMS.Seeds.FullCommunity do
  @moduledoc false

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Seeds.{Articles, Communities, Tags}
  alias Helper.T

  @content_threads [:post, :changelog, :doc]
  @kanban_states [:todo, :wip, :done]
  @article_count_per_thread 23
  @comment_count_per_article 23

  @spec mock(String.t() | atom()) :: T.domain_res(map())
  def mock(slug) do
    with {:ok, community} <- Communities.mock(slug),
         {:ok, _} <- seed_about_dashboard(community, slug),
         {:ok, posts} <- seed_content_threads(community),
         {:ok, _} <- seed_kanban_states(posts),
         {:ok, updated_community} <- CMS.Communities.read(community.slug, inc_views: false) do
      {:ok, updated_community}
    end
  end

  defp seed_content_threads(community) do
    posts =
      Enum.reduce(@content_threads, [], fn thread, acc ->
        {:ok, tag_ids} = Tags.mock(community, thread)

        {:ok, articles} =
          Articles.mock(
            community,
            thread,
            count_range: {@article_count_per_thread, @article_count_per_thread},
            comment_range: {@comment_count_per_article, @comment_count_per_article},
            tag_ids: tag_ids
          )

        case thread do
          :post -> acc ++ articles
          _ -> acc
        end
      end)

    {:ok, posts}
  end

  defp seed_kanban_states(posts) when is_list(posts) do
    posts
    |> Enum.with_index()
    |> Enum.each(fn {post, idx} ->
      state = Enum.at(@kanban_states, rem(idx, length(@kanban_states)))
      CMS.Articles.set_state(post, state)
    end)

    {:ok, :ok}
  end

  defp seed_about_dashboard(community, slug) do
    slug = to_string(slug)

    with {:ok, _} <-
           CMS.Communities.update_dashboard(community, :enable, %{
             about: true,
             about_techstack: true,
             about_location: true,
             about_links: true,
             about_media_report: true,
             post: true,
             changelog: true,
             kanban: true,
             doc: true
           }),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :base_info, %{
             title: String.capitalize(slug),
             slug: slug,
             desc: "#{slug} community",
             homepage: "https://#{slug}.example.com",
             introduction: "Built with seed data for QA and showcase.",
             city: "Shanghai,Singapore,Berlin",
             techstack: "Elixir,Phoenix,PostgreSQL,TypeScript,React"
           }),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :social_links, [
             %{type: "github", link: "https://github.com/#{slug}"},
             %{type: "twitter", link: "https://x.com/#{slug}"},
             %{type: "website", link: "https://#{slug}.example.com"}
           ]),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :media_reports, [
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
           ]) do
      {:ok, :ok}
    end
  end
end
