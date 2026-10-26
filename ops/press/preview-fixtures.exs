unless System.get_env("PHX_HOST") == "groupher-press-preview-api.fly.dev" and
         URI.parse(System.fetch_env!("DATABASE_URL")).path == "/groupher_preview" do
  raise "Press fixtures require the isolated preview Phoenix app and database"
end

defmodule GroupherServer.PressPreview.SearchSink do
  @moduledoc "Search provider sink used only by the isolated Press acceptance fixture."
  @behaviour GroupherServer.CMS.SearchArtiments.PlatformAdapter

  def upsert(_articles, _opts), do: {:ok, :pass}
  def delete(_refs), do: {:ok, :pass}
  def update_metrics(_updates), do: {:ok, :pass}
  def search(_query), do: {:error, :search_outside_press_acceptance}
end

defmodule GroupherServer.PressPreview.Fixtures do
  @moduledoc "Creates and transitions synthetic content for live Press acceptance."

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Support.Factory

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    Community,
    DocLifecycle,
    DocPublic,
    DocTreeNode
  }

  @slug "press-preview"

  def prepare do
    config = Application.fetch_env!(:groupher_server, :search_artiments)

    Application.put_env(
      :groupher_server,
      :search_artiments,
      Keyword.put(config, :platform, GroupherServer.PressPreview.SearchSink)
    )

    {:ok, :pass}
  end

  def seed do
    {:ok, :pass} = prepare()

    Repo.transaction(fn ->
      community =
        case Repo.get_by(Community, slug: @slug) do
          nil ->
            {:ok, user} =
              Factory.db_insert(:user, login: "press-preview", nickname: "Press Preview")

            {:ok, community} =
              Factory.mock_community(user, %{
                slug: @slug,
                aka: @slug,
                title: "Press Preview"
              })

            for thread <- [:post, :blog, :changelog, :doc] do
              {_, article, _, _} = Factory.mock_article(thread, community, user)

              if thread == :doc do
                for attrs <- [
                      %{node_id: "press-tab", type: :tab, title: "Docs", index: 0},
                      %{
                        node_id: "press-group",
                        parent_node_id: "press-tab",
                        type: :group,
                        title: "Guide",
                        index: 0
                      },
                      %{
                        node_id: "press-page",
                        parent_node_id: "press-group",
                        doc_id: article.id,
                        type: :page,
                        title: article.title,
                        index: 0
                      }
                    ] do
                  %DocTreeNode{}
                  |> DocTreeNode.changeset(
                    Map.merge(attrs, %{
                      community_id: community.id,
                      branch_id: article.branch_id,
                      stage: :public
                    })
                  )
                  |> Repo.insert!()
                end
              end
            end

            {:ok, _config} =
              CMS.Press.update_config(
                community,
                %{
                  feed_enabled: true,
                  feed_count: 5,
                  feed_threads: [:post, :blog, :changelog, :doc]
                },
                user,
                Ecto.UUID.generate()
              )

            community

          community ->
            community
        end

      snapshot(community)
    end)
  end

  def snapshot(community \\ Repo.get_by!(Community, slug: @slug)) do
    articles =
      Repo.all(
        from(article in Article,
          join: binding in ArticleBinding,
          on: binding.article_id == article.id,
          where: binding.community_id == ^community.id,
          order_by: binding.inner_id,
          select: %{id: article.id, thread: article.thread, inner_id: binding.inner_id}
        )
      )

    %{community: community.slug, community_id: community.id, articles: articles}
  end

  def hold(thread) do
    {:ok, :pass} = prepare()

    Repo.transaction(fn ->
      lifecycle = locked_lifecycle(thread)
      source_ref = "press-preview-#{Ecto.UUID.generate()}"

      {:ok, restriction} =
        CMS.ReviewBlocks.apply(lifecycle, %{
          scope_key: "platform",
          type: :manual_hold,
          source_ref: source_ref,
          source: :human,
          applied_at: DateTime.utc_now(:second)
        })

      %{thread: thread, restriction_id: restriction.id, operation_ref: source_ref}
    end)
  end

  def restore(thread) do
    {:ok, :pass} = prepare()

    Repo.transaction(fn ->
      lifecycle = locked_lifecycle(thread)
      {:ok, restrictions} = CMS.ReviewBlocks.active_for(lifecycle, "platform")
      operation_ref = Ecto.UUID.generate()

      {:ok, :pass} =
        CMS.ReviewBlocks.end_blocks(
          lifecycle,
          "platform",
          Enum.map(restrictions, & &1.id),
          operation_ref,
          "review_approved"
        )

      %{thread: thread, operation_ref: operation_ref}
    end)
  end

  def probe do
    results =
      for path <- ["post/1.md", "doc/4.md", "doc/feed.xml", "feed.json"] do
        response =
          Req.get!("https://edge-router-preview.groupher.workers.dev/#{@slug}/#{path}",
            decode_body: false,
            receive_timeout: 30_000,
            retry: false
          )

        %{
          path: path,
          status: response.status,
          cf_ray: List.first(Req.Response.get_header(response, "cf-ray")),
          doc_feed_items:
            if(path == "doc/feed.xml", do: length(Regex.scan(~r/<item>/, response.body))),
          feed_items:
            if(path == "feed.json", do: length(Jason.decode!(response.body)["items"] || []))
        }
      end

    {:ok, results}
  end

  defp locked_lifecycle(thread) do
    %{articles: articles} = snapshot()
    article = Enum.find(articles, &(&1.thread == thread))

    if thread == :doc do
      public = Repo.get_by!(DocPublic, article_id: article.id)

      Repo.one!(
        from(lifecycle in DocLifecycle,
          where: lifecycle.article_id == ^article.id and lifecycle.branch_id == ^public.branch_id,
          lock: "FOR UPDATE"
        )
      )
    else
      Repo.one!(
        from(lifecycle in ArticleLifecycle,
          where: lifecycle.article_id == ^article.id,
          lock: "FOR UPDATE"
        )
      )
    end
  end
end
