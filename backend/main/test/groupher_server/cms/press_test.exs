defmodule GroupherServer.Test.CMS.Press do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.{
    CommunityLifecycle,
    DocPublishRelease,
    DocTreeNode,
    DocTreeSnapshot,
    Post,
    PressConfig
  }

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
        inner_id: post.inner_id
      })

    assert projection.article_ref == post.article_hash_id
    assert is_binary(projection.markdown)
    assert projection.canonical_path == "/#{community.slug}/post/#{post.inner_id}"

    persisted = Repo.get!(Post, post.id)
    assert persisted.views == post.views
  end

  test "origin projections hide communities that are not publicly active", ~m(community post)a do
    community
    |> Ecto.Changeset.change(pending: Helper.Constant.CMS.pending(:applying))
    |> Repo.update!()

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :setting_up})
    |> Repo.update!()

    assert {:error, {:not_exist, "Public Community"}} =
             CMS.Press.article(%{
               community: community.slug,
               thread: :post,
               inner_id: post.inner_id
             })
  end

  test "Docs Markdown requires membership in the current public main tree" do
    {community, doc, _attrs, _user} = mock_article(:doc)
    path = %{community: community.slug, thread: :doc, inner_id: doc.inner_id}

    assert {:error, {:not_exist, "Published Doc"}} = CMS.Press.article(path)

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
        doc_id: doc.article_hash_id,
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

    assert {:ok, %{article_ref: article_ref, markdown: markdown}} = CMS.Press.article(path)
    assert article_ref == doc.article_hash_id
    assert is_binary(markdown)
  end

  test "GraphQL exposes the Press origin contract with the agreed RSS acronym",
       ~m(community user)a do
    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user
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
    mutation UpdatePress($input: UpdatePressConfigInput!) {
      updatePressConfig(input: $input) {
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
        }
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
               user
             )

    assert config.feed_enabled
    assert config.feed_type == :full
    assert config.feed_count == 12
    assert config.feed_threads == ["post", "changelog"]
    assert config.revision == 1

    assert {:ok, updated} = CMS.Press.update_config(community, %{feed_count: 15}, user)
    assert updated.revision == 2
  end

  test "feed reads selected public articles in one bounded projection",
       ~m(community post user)a do
    assert {:ok, _config} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 5, feed_threads: [:post]},
               user
             )

    assert {:ok, feed} = CMS.Press.community_rss_feed(community)
    assert feed.config_revision == 1
    assert [%{article_ref: article_ref, thread: :post}] = feed.items
    assert article_ref == post.article_hash_id

    assert {:ok, thread_feed} = CMS.Press.thread_rss_feed(community, :post)
    assert thread_feed.thread == :post
    assert thread_feed.feed_revision == feed.feed_revision
  end

  test "Docs Feed exposes only the latest main-branch publish release", ~m(community user)a do
    {:ok, branch} = CMS.Docs.Branch.resolve(community, nil)
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
               user
             )

    assert {:ok, %{items: [item]}} = CMS.Press.thread_rss_feed(community, :doc)
    assert item.article_ref == "#{community.slug}:docs:v2"
    assert item.article_revision == "release-2"
    assert item.thread == :doc
  end

  test "feed validation rejects disabled or invalid configuration", ~m(community user)a do
    assert {:error, {:custom, "Press output is disabled"}} =
             CMS.Press.community_rss_feed(community)

    assert {:error, %Ecto.Changeset{}} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 51, feed_threads: [:post]},
               user
             )

    assert {:error, %Ecto.Changeset{errors: [feed_threads: _]}} =
             CMS.Press.update_config(
               community,
               %{feed_enabled: true, feed_count: 20, feed_threads: []},
               user
             )
  end
end
