defmodule GroupherServer.Test.CMS.Press do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  alias CMS.Model.{
    ArticleStats,
    ArticlePublic,
    CommunityLifecycle,
    DocPublishRelease,
    DocPublic,
    DocTreeNode,
    DocTreeSnapshot,
    PressConfig
  }

  alias CMS.Outbox.Event

  alias Ecto.Changeset
  alias CMS.Docs.Branch
  alias GroupherServerWeb.Schema

  setup do
    {community, post, attrs, user} = mock_article(:post)
    {:ok, ~m(community post attrs user)a}
  end

  test "article returns persisted Markdown without increasing human views", ~m(community post)a do
    {:ok, projection} =
      CMS.Press.article(%{
        community: community.slug,
        thread: :post,
        inner_id: article_inner_id(post, community)
      })

    assert projection.article_id == post.id
    assert is_binary(projection.markdown)

    assert projection.canonical_path ==
             "/#{community.slug}/post/#{article_inner_id(post, community)}"

    assert Repo.get_by!(ArticleStats, thread: :post, article_id: post.id).views == 0
  end

  test "origin projections hide communities that are not publicly active", ~m(community post)a do
    community
    |> Changeset.change(pending: GroupherServer.CMS.Communities.Const.pending_state(:applying))
    |> Repo.update!()

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :setting_up})
    |> Repo.update!()

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :community},
              reason: :not_exist,
              details: "Public Community"
            }} =
             CMS.Press.article(%{
               community: community.slug,
               thread: :post,
               inner_id: article_inner_id(post, community)
             })
  end

  test "Docs Markdown requires membership in the current public main tree" do
    {community, doc, _attrs, _user} = mock_article(:doc)
    path = %{community: community.slug, thread: :doc, inner_id: article_inner_id(doc, community)}

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :article},
              reason: :not_exist,
              details: "Published Doc"
            }} = CMS.Press.article(path)

    nodes = [
      %{node_id: "tab-1", type: :tab, title: "Docs", index: 0},
      %{
        node_id: "group-1",
        parent_node_id: "tab-1",
        type: :group,
        title: "Guide",
        index: 0
      },
      %{
        node_id: "page-1",
        parent_node_id: "group-1",
        doc_id: doc.id,
        type: :page,
        title: doc.title,
        index: 0
      }
    ]

    for attrs <- nodes do
      %DocTreeNode{}
      |> DocTreeNode.changeset(
        Map.merge(attrs, %{
          community_id: community.id,
          branch_id: doc.branch_id,
          stage: :public
        })
      )
      |> Repo.insert!()
    end

    assert {:ok, %{article_id: article_id, markdown: markdown}} = CMS.Press.article(path)
    assert article_id == doc.id
    assert is_binary(markdown)
  end

  test "site manifest pages through the platform maximum instead of returning an empty list",
       ~m(community post)a do
    assert {:ok, %{items: items}} = CMS.Press.site_manifest(community)

    assert Enum.any?(items, &(&1.item_id == post.id))
  end

  test "site manifest collects public Articles across more than one page",
       ~m(community user)a do
    for _ <- 1..100 do
      mock_article(:post, community, user)
    end

    assert {:ok, %{items: items}} = CMS.Press.site_manifest(community)
    assert length(items) == 101
  end

  test "Press uses public projection timestamps for feed items",
       ~m(community post user)a do
    published_at = DateTime.utc_now(:second) |> DateTime.add(-2, :day)
    updated_at = DateTime.utc_now(:second) |> DateTime.add(-1, :hour)

    Repo.update_all(
      from(public in ArticlePublic, where: public.article_id == ^post.id),
      set: [published_at: published_at, updated_at: updated_at]
    )

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: [item]}} = CMS.Press.thread_rss_feed(community, :post)
    assert item.published_at == published_at
    assert item.updated_at == updated_at
  end

  test "Press request boundaries propagate batch hydration errors", ~m(community user)a do
    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    error = CMS.ErrorCat.invalid_body("Article body projection is missing")
    hydrate = fn _paths -> {:error, error} end

    assert {:error, ^error} = CMS.Press.site_manifest(community, hydrate_articles: hydrate)

    assert {:error, ^error} =
             CMS.Press.thread_rss_feed(community, :post, hydrate_articles: hydrate)
  end

  test "Doc manifest keeps the public slug in its canonical URL",
       ~m(community user)a do
    {_, doc, _, _} = mock_article(:doc, community, user)
    doc_public = Repo.get_by!(DocPublic, article_id: doc.id, branch_id: doc.branch_id)

    assert {:ok, _} =
             doc_public
             |> DocPublic.changeset(%{slug: "canonical-page"})
             |> Repo.update()

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
            type: :page,
            title: doc.title,
            doc_id: doc.id,
            index: 0
          }
        ] do
      %DocTreeNode{}
      |> DocTreeNode.changeset(
        Map.merge(attrs, %{
          community_id: community.id,
          branch_id: doc.branch_id,
          stage: :public
        })
      )
      |> Repo.insert!()
    end

    assert {:ok, %{items: items}} = CMS.Press.site_manifest(community)
    item = Enum.find(items, &(&1.item_id == doc.id))

    assert item

    assert String.ends_with?(
             item.canonical_url,
             "/doc/#{article_inner_id(doc, community)}/canonical-page"
           )
  end

  test "GraphQL exposes the Press origin contract with the agreed RSS acronym",
       ~m(community user)a do
    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    query = """
    query PressOrigin($community: String!, $input: PressCommunityRSSFeedInput!) {
      pressConfig(community: $community) { feedEnabled revision }
      pressCommunityRSSFeed: pressCommunityRssFeed(community: $community, input: $input) { feedRevision }
    }
    """

    assert {:ok,
            %{
              data: %{
                "pressConfig" => %{"feedEnabled" => true, "revision" => 1},
                "pressCommunityRSSFeed" => %{"feedRevision" => feed_revision}
              }
            }} =
             Absinthe.run(query, Schema,
               variables: %{"community" => community.slug, "input" => %{}},
               context: %{
                 service_actor: %{
                   audience: "phoenix:press-api",
                   scopes: MapSet.new(["press:rss-feed:read"]),
                   subject: "service:press",
                   token_id: "test-token"
                 }
               }
             )

    assert is_binary(feed_revision)
  end

  test "Dashboard mutation authorizes the nested community input and persists config",
       ~m(community)a do
    mutation = """
    mutation UpdatePress($input: UpdatePressConfigInput!, $commandId: ID!) {
      updatePressConfig(input: $input, commandId: $commandId) {
        config { feedEnabled feedCount feedThreads revision }
      }
    }
    """

    connection = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

    updated =
      gq_mutation(connection, mutation, %{
        input: %{
          community: community.slug,
          feedEnabled: true,
          feedCount: 10,
          feedThreads: ["POST"]
        },
        commandId: Ecto.UUID.generate()
      })

    assert get_in(updated, ["config", "feedEnabled"])
    assert get_in(updated, ["config", "feedCount"]) == 10
    assert get_in(updated, ["config", "feedThreads"]) == ["POST"]
  end

  test "config migrates legacy RSS defaults and persists explicit Press settings",
       ~m(community user)a do
    assert {:ok, %{feed_enabled: false, feed_type: :digest, feed_count: 20}} =
             CMS.Press.config(community)

    assert {:ok, %PressConfig{} = config} =
             CMS.Press.update_config(
               community,
               %{
                 feed_enabled: true,
                 feed_type: :full,
                 feed_count: 12,
                 feed_threads: [:post, :changelog]
               },
               user,
               Ecto.UUID.generate()
             )

    assert config.feed_enabled
    assert config.feed_type == :full
    assert config.feed_count == 12
    assert config.feed_threads == ["post", "changelog"]
    assert config.revision == 1

    activity =
      Repo.get_by!(GroupherServer.Activity.Model.PressLog,
        community_id: community.id,
        action: :config_updated
      )

    assert Enum.sort(activity.changed_fields) ==
             Enum.sort(["feed_enabled", "feed_type", "feed_count", "feed_threads"])

    assert {:ok, updated} =
             CMS.Press.update_config(community, %{feed_count: 15}, user, Ecto.UUID.generate())

    assert updated.revision == 2
  end

  test "same Press config command identity recovers the first revision",
       ~m(community user)a do
    command_id = Ecto.UUID.generate()
    attrs = %{feed_enabled: true, feed_count: 12, feed_threads: [:post]}

    assert {:ok, %PressConfig{revision: 1}} =
             CMS.Press.update_config(community, attrs, user, command_id)

    assert {:ok, %PressConfig{revision: 1}} =
             CMS.Press.update_config(community, attrs, user, command_id)

    assert {:ok, %PressConfig{revision: 1}} = CMS.Press.config(community)

    assert [%Event{} = event] =
             Repo.all(
               from(event in Event,
                 where:
                   event.command_id == ^command_id and
                     event.event == "press.cache_invalidation"
               )
             )

    assert event.identity_type == :command
    assert event.contract_version == 1
    assert event.resource_type == "community"
    assert event.resource_id == to_string(community.id)
    assert event.effect_key == "config"
    assert event.data == %{}
  end

  test "feed reads selected public articles in one bounded projection",
       ~m(community post user)a do
    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, feed} = CMS.Press.community_rss_feed(community)
    assert feed.config_revision == 1
    assert [%{item_id: article_id, thread: :post}] = feed.items
    assert article_id == post.id

    assert {:ok, thread_feed} = CMS.Press.thread_rss_feed(community, :post)
    assert thread_feed.thread == :post
    assert thread_feed.feed_revision == feed.feed_revision
  end

  test "feed keeps the configured 50-item bound across multiple threads",
       ~m(community post user)a do
    {_, blog, _attrs, _blog_user} = mock_article(:blog, community, user)

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 50, feed_threads: [:post, :blog]},
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: items}} = CMS.Press.community_rss_feed(community)
    assert Enum.map(items, & &1.item_id) |> Enum.sort() == Enum.sort([post.id, blog.id])
  end

  test "feed keeps pinned candidates in the pre-limit set before final sorting",
       ~m(community post user)a do
    assert {:ok, _pinned} =
             CMS.Articles.pin(community, post.id, user, Ecto.UUID.generate())

    newer_posts =
      for index <- 1..5 do
        {_, newer_post, _, _} = mock_article(:post, community, user)
        newer_at = DateTime.utc_now(:second) |> DateTime.add(index, :second)

        Repo.update_all(
          from(public in ArticlePublic, where: public.article_id == ^newer_post.id),
          set: [published_at: newer_at, updated_at: newer_at]
        )

        newer_post
      end

    old_at = DateTime.utc_now(:second) |> DateTime.add(-1, :day)

    Repo.update_all(
      from(public in ArticlePublic, where: public.article_id == ^post.id),
      set: [published_at: old_at, updated_at: old_at]
    )

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: items}} = CMS.Press.thread_rss_feed(community, :post)

    assert MapSet.new(Enum.map(items, & &1.item_id)) ==
             MapSet.new(Enum.map(newer_posts, & &1.id))
  end

  test "Docs Feed exposes only the latest main-branch publish release", ~m(community user)a do
    {:ok, branch} = Branch.resolve(community, nil)
    published_at = DateTime.utc_now(:second)

    for release_number <- 1..2 do
      snapshot =
        %DocTreeSnapshot{}
        |> DocTreeSnapshot.changeset(%{
          community_id: community.id,
          branch_id: branch.id,
          author_id: user.id,
          tree_json: %{},
          tree_hash: "tree-#{release_number}",
          published_at: DateTime.add(published_at, release_number, :second)
        })
        |> Repo.insert!()

      %DocPublishRelease{}
      |> DocPublishRelease.changeset(%{
        community_id: community.id,
        branch_id: branch.id,
        tree_snapshot_id: snapshot.id,
        author_id: user.id,
        release_number: release_number,
        version_slug: "v#{release_number}",
        published_at: DateTime.add(published_at, release_number, :second)
      })
      |> Repo.insert!()
    end

    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:doc]},
               user,
               Ecto.UUID.generate()
             )

    assert {:ok, %{items: [item]}} = CMS.Press.thread_rss_feed(community, :doc)
    assert item.item_id == "#{community.slug}:docs:v2"
    assert item.article_revision == "release-2"
    assert item.thread == :doc
  end

  test "feed validation rejects disabled or invalid configuration", ~m(community user)a do
    assert {:error, %ErrorCat.Error{reason: :custom, details: "Press output is disabled"}} =
             CMS.Press.community_rss_feed(community)

    assert {:error, %Ecto.Changeset{}} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 51, feed_threads: [:post]},
               user,
               Ecto.UUID.generate()
             )

    assert {:error, %Ecto.Changeset{errors: [feed_threads: _]}} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 20, feed_threads: []},
               user,
               Ecto.UUID.generate()
             )
  end
end
