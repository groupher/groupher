defmodule GroupherServer.Test.Query.CMS.ArtimentMentions do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query

  alias GroupherServer.{CMS, Pagi, Repo, ReviewBot}
  alias ReviewBot.Model.ReviewBotConfig
  alias CMS.ArtimentMentions
  alias CMS.Model.Mentions.Endpoint
  alias Pagi.Params

  @site_host ArtimentMentions.Config.site_host()
  @mentions_query S.Mention.q(:mentions)
  @mentioned_by_query S.Mention.q(:mentioned_by)
  @map_query """
  query($community: String!, $focus: MentionsGraphLocatorInput!,
        $after: String, $first: Int) {
    mentionsGraph(community: $community, focus: $focus, after: $after, first: $first) {
      revision
      nodes { id type status title url canOpen locator { type articleInnerId commentInnerId } }
      edges { id from to occurrencesCount }
      hasNextPage endCursor
    }
  }
  """
  @article_comments_query """
  query($community: String!, $focus: MentionsGraphLocatorInput!, $after: ID, $first: Int) {
    mentionsGraphArticleComments(community: $community, focus: $focus, after: $after, first: $first) {
      revision
      comments { type articleInnerId commentInnerId }
      hasNextPage
      endCursor
    }
  }
  """
  @mentioned_comment_query """
  query($community: String!, $locator: MentionsGraphLocatorInput!) {
    mentionedComment(community: $community, locator: $locator) {
      innerId
      body { html }
    }
  }
  """
  @artiment_status_query """
  query($community: String!, $locator: ArtimentStatusInput!) {
    artimentStatus(community: $community, locator: $locator) {
      type status title url
    }
  }
  """

  setup do
    {community, post, _attrs, user} = mock_article(:post)
    {_, blog, _, _} = mock_article(:blog, community, user)

    {:ok,
     %{guest_conn: simu_conn(:guest), community: community, post: post, blog: blog, user: user}}
  end

  test "a resource status page does not require a Mention edge or binding",
       %{guest_conn: guest_conn, community: community, post: post} do
    Repo.delete_all(
      from(binding in CMS.Model.ArticleBinding,
        where: binding.article_id == ^post.article_id
      )
    )

    locator = %{type: "POST", article_id: post.article_id}

    node =
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: locator
      })

    assert node["status"] == "UNAVAILABLE"
    assert node["url"] == "/#{community.slug}/post/#{post.article_id}"
    assert is_binary(node["title"])

    Repo.update_all(
      from(lifecycle in CMS.Model.ArticleLifecycle,
        where: lifecycle.article_id == ^post.article_id
      ),
      set: [state: :deleted]
    )

    trash_node =
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: locator
      })

    assert trash_node["status"] == "DELETED"

    Repo.update_all(
      from(lifecycle in CMS.Model.ArticleLifecycle,
        where: lifecycle.article_id == ^post.article_id
      ),
      set: [state: :destroy]
    )

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: locator
      })
    end
  end

  test "Doc status page uses the main resource path without any Mention edge",
       %{guest_conn: guest_conn, community: community, user: user} do
    {_, doc, _, _} = mock_article(:doc, community, user)

    node =
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: %{type: "DOC", article_id: doc.article_id}
      })

    assert node["url"] =~ ~r{^/#{community.slug}/doc/[^/]+/[^/]+$}
    assert node["type"] == "DOC"
  end

  test "Comment status is readable by its parent stable ID without consulting graph edges",
       %{guest_conn: guest_conn, community: community, post: post, user: user} do
    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(post, community),
               mock_comment(),
               user,
               Ecto.UUID.generate()
             )

    node =
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: %{
          type: "COMMENT",
          article_id: post.article_id,
          comment_inner_id: comment.inner_id
        }
      })

    assert node["type"] == "COMMENT"
    assert node["url"] =~ "#comment-#{comment.inner_id}"
    assert is_binary(node["title"])

    Repo.update_all(
      from(binding in CMS.Model.ArticleBinding,
        where: binding.article_id == ^post.article_id and binding.community_id == ^community.id
      ),
      set: [inner_id: nil]
    )

    stable_node =
      gq_query(guest_conn, @artiment_status_query, %{
        community: community.slug,
        locator: %{
          type: "COMMENT",
          article_id: post.article_id,
          comment_inner_id: comment.inner_id
        }
      })

    assert stable_node["url"] ==
             "/#{community.slug}/post/#{post.article_id}#comment-#{comment.inner_id}"
  end

  @tag :b2_independent
  test "public one-hop queries expose opaque identity and current Community paths",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)

    mentions =
      guest_conn
      |> gq_query(@mentions_query, %{
        community: community.slug,
        source: %{type: "POST", article_inner_id: source_path.inner_id},
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert mentions["pageInfo"]["totalCount"] == 2
    assert String.match?(mentions["revision"], ~r/^\d+$/)
    internal = Enum.find(mentions["entries"], &(&1["targetType"] == "BLOG"))
    assert String.starts_with?(internal["id"], "edge:#{community.id}:")
    assert internal["source"]["url"] == "/#{community.slug}/post/#{source_path.inner_id}"

    assert internal["target"]["url"] ==
             "/#{community.slug}/blog/#{article_inner_id(blog, community)}"

    assert internal["occurrencesCount"] == 1

    external = Enum.find(mentions["entries"], &(&1["targetType"] == "URL"))
    assert external["target"]["url"] == "https://example.com/a"

    encoded = Jason.encode!(mentions)
    refute String.contains?(encoded, article.id)
    refute String.contains?(encoded, blog.article_id)

    incoming =
      guest_conn
      |> gq_query(@mentioned_by_query, %{
        community: community.slug,
        target: %{
          type: "BLOG",
          locator: %{type: "BLOG", article_inner_id: article_inner_id(blog, community)}
        },
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert incoming["pageInfo"]["totalCount"] == 1
    assert incoming["revision"] == mentions["revision"]
    assert hd(incoming["entries"])["id"] == internal["id"]
  end

  @tag :b2_independent
  test "a mismatched root Community cannot read another Community's locator",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_article, source_path} = published_source(community, blog, user)
    {:ok, other} = mock_community(user)

    assert_raise ExUnit.AssertionError, ~r/GraphQL operation mentions returned errors/, fn ->
      gq_query(guest_conn, @mentions_query, %{
        community: other.slug,
        source: %{type: "POST", article_inner_id: source_path.inner_id}
      })
    end
  end

  @tag :b2_independent
  test "User Ticket is a public one-hop target and root",
       %{guest_conn: guest_conn, community: community, post: post, user: user} do
    grants = %{
      "ticket.create" => true,
      "ticket.manage_visibility" => true,
      "ticket.read_internal" => true
    }

    actor = %{user | cur_passport: %{"global" => %{}, community.slug => %{"cms" => grants}}}

    {:ok, ticket} =
      CMS.Tickets.create_from_post(
        community,
        post.id,
        %{title: "Referenced User Ticket", digest: "Public summary"},
        actor,
        Ecto.UUID.generate()
      )

    {:ok, draft_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)

    assert {:ok, _} =
             CMS.Tickets.publish(
               community,
               ticket.id,
               "Public release",
               draft_ticket.draft_version,
               draft_ticket.lifecycle_version,
               draft_ticket.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(community.id, ticket.id)
             )

    {:ok, published_ticket} = CMS.Tickets.get_internal(community, ticket.id, actor)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "ticket-reference",
          "children" => [
            %{
              "type" => "a",
              "url" => "#{@site_host}/#{community.slug}/ticket/#{published_ticket.inner_id}",
              "children" => [%{"text" => "Published ticket"}]
            }
          ]
        }
      ])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        community,
        :post,
        %{title: "Ticket reference", digest: "Ticket", body_bag: mock_body_bag(body)},
        user
      )

    command_id = Ecto.UUID.generate()

    assert {:ok, _} =
             CMS.Articles.publish(article.id, user,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: command_id
             )

    source_path = %{
      community: community.slug,
      thread: "POST",
      inner_id: article_inner_id(article, community)
    }

    target_path = %{community: community.slug, inner_id: published_ticket.inner_id}

    outgoing =
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{type: "POST", article_inner_id: source_path.inner_id}
      })

    assert [%{"targetType" => "TICKET", "target" => %{"url" => ticket_url}}] =
             outgoing["entries"]

    assert ticket_url == "/#{community.slug}/ticket/#{published_ticket.inner_id}"

    incoming =
      gq_query(guest_conn, @mentioned_by_query, %{
        community: community.slug,
        target: %{
          type: "TICKET",
          locator: %{type: "TICKET", article_inner_id: target_path.inner_id}
        },
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert incoming["pageInfo"]["totalCount"] == 1
    assert hd(incoming["entries"])["id"] == hd(outgoing["entries"])["id"]

    ticket_root =
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{type: "TICKET", article_inner_id: target_path.inner_id},
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert ticket_root["pageInfo"]["totalCount"] == 0

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{type: "TICKET", article_inner_id: 999_999}
      })
    end
  end

  @tag :b2_independent
  test "public map returns directed opaque adjacency and current paths",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}

    result =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        first: 1
      })

    page = result
    assert length(page["nodes"]) == 2
    assert [edge] = page["edges"]
    assert edge["occurrencesCount"] == 1
    assert String.starts_with?(edge["id"], "edge:#{community.id}:")
    assert page["hasNextPage"] == false

    revision =
      gq_query(
        guest_conn,
        """
        query($community: String!, $focus: MentionsGraphLocatorInput!) {
          mentionsGraphRevision(community: $community, focus: $focus)
        }
        """,
        %{community: community.slug, focus: focus}
      )

    assert String.match?(revision, ~r/^\d+$/)
    assert page["revision"] == revision

    encoded = Jason.encode!(page)
    refute String.contains?(encoded, article.id)
    refute String.contains?(encoded, blog.article_id)
  end

  test "public Map and Article Comments remain readable from Y after physically deleting X",
       %{guest_conn: guest_conn, community: source_community, post: post, user: user} do
    {:ok, destination} = mock_community(user)
    article = Repo.get!(CMS.Model.Article, post.article_id)

    assert {:ok, {:ok, _binding}} =
             Repo.transaction(fn -> CMS.Articles.BindingPersist.mirror(article, destination) end)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               source_community,
               :post,
               article_inner_id(post, source_community),
               mock_comment(),
               user,
               Ecto.UUID.generate()
             )

    Repo.delete_all(
      from(config in ReviewBotConfig, where: config.community_id == ^source_community.id)
    )

    Repo.query!("DELETE FROM cms.artiment_reviews WHERE community_id = $1", [source_community.id])
    Repo.delete!(source_community)

    focus = %{type: "POST", article_inner_id: article_inner_id(post, destination)}

    map =
      gq_query(guest_conn, @map_query, %{
        community: destination.slug,
        focus: focus,
        first: 10
      })

    assert Enum.any?(
             map["nodes"],
             &(&1["locator"]["articleInnerId"] == to_string(focus.article_inner_id))
           )

    comments =
      gq_query(guest_conn, @article_comments_query, %{
        community: destination.slug,
        focus: focus,
        first: 10
      })

    assert comments["revision"] == map["revision"]
    assert comments["comments"] == []
    # A fresh database may assign the same number to a private Comment ID and
    # a legitimate Community-local Article ID; verify the typed node field.
    refute Enum.any?(map["nodes"], &(&1["id"] == to_string(comment.id)))
    assert Enum.all?(map["nodes"], &String.starts_with?(&1["id"], "article:#{destination.id}:"))
  end

  @tag :b2_independent
  test "graph page records SQL count for one focus",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    ref = make_ref()
    handler = "mentions-graph-query-count-#{System.unique_integer([:positive])}"

    :ok =
      :telemetry.attach(
        handler,
        [:groupher_server, :repo, :query],
        fn _event, _measurements, metadata, {pid, reference} ->
          if self() == pid, do: send(pid, {reference, metadata.query})
        end,
        {self(), ref}
      )

    try do
      page =
        gq_query(guest_conn, @map_query, %{
          community: community.slug,
          focus: focus
        })

      assert length(page["edges"]) == 1
      count = count_queries(ref, 0)
      assert count > 0
      IO.puts("B2 graph GraphQL SQL count: #{count}")
    after
      :telemetry.detach(handler)
    end
  end

  @tag :b2_independent
  test "one focus returns a bounded graph page and records SQL count",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_source, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}

    ref = make_ref()
    handler = "mentions-graph-first-two-query-count-#{System.unique_integer([:positive])}"

    :ok =
      :telemetry.attach(
        handler,
        [:groupher_server, :repo, :query],
        fn _event, _measurements, metadata, {pid, reference} ->
          if self() == pid, do: send(pid, {reference, metadata.query})
        end,
        {self(), ref}
      )

    try do
      page =
        gq_query(guest_conn, @map_query, %{
          community: community.slug,
          focus: focus,
          first: 2
        })

      assert page["hasNextPage"] == false
      assert length(page["edges"]) == 1
      count = count_queries(ref, 0)
      assert count > 0
      IO.puts("B2 graph first=2 SQL count: #{count}")
    after
      :telemetry.detach(handler)
    end
  end

  defp count_queries(ref, count) do
    receive do
      {^ref, query} ->
        increment =
          if String.match?(String.trim_leading(query), ~r/^(SELECT|INSERT|UPDATE|DELETE)/),
            do: 1,
            else: 0

        count_queries(ref, count + increment)
    after
      0 -> count
    end
  end

  test "an unrelated Comment does not affect the requested graph",
       %{guest_conn: guest_conn, community: community, post: post, blog: blog, user: user} do
    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment("Pending outside the requested graph"),
        user,
        Ecto.UUID.generate()
      )

    endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    assert %Endpoint{} = Repo.get!(Endpoint, endpoint.id)

    focus = %{type: "BLOG", article_inner_id: article_inner_id(blog, community)}

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus
      })

    assert page["edges"] == []
  end

  @tag :b2_independent
  test "invalid cursor is rejected", %{
    guest_conn: guest_conn,
    community: community,
    post: post
  } do
    focus = %{type: "POST", article_inner_id: article_inner_id(post, community)}

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        after: "broken"
      })
    end
  end

  test "Comment focus uses the parent public path and never returns its database ID",
       %{guest_conn: guest_conn, community: community, post: post, user: user} do
    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_body_bag(
          Jason.encode!([
            %{"type" => "p", "id" => "comment", "children" => [%{"text" => "A public comment"}]}
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    project_comment(comment)

    focus = %{
      type: "COMMENT",
      article_inner_id: article_inner_id(post, community),
      comment_inner_id: comment.inner_id
    }

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus
      })

    assert [
             %{
               "id" => public_node_id,
               "type" => "COMMENT",
               "locator" => %{
                 "type" => "COMMENT",
                 "commentInnerId" => public_id
               },
               "url" => url
             }
           ] = page["nodes"]

    assert public_id == to_string(comment.inner_id)

    assert public_node_id ==
             "comment:#{community.id}:post:#{article_inner_id(post, community)}:#{comment.inner_id}"

    assert url ==
             "/#{community.slug}/post/#{article_inner_id(post, community)}#comment-#{comment.inner_id}"

    refute String.contains?(Jason.encode!(page), "\"#{comment.id}\"")
  end

  test "Article discovers its own Comment references without inventing parent edges",
       %{guest_conn: guest_conn, community: community, post: post, blog: blog, user: user} do
    post_id = article_inner_id(post, community)
    blog_id = article_inner_id(blog, community)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "comment-references",
          "children" => [
            %{
              "type" => "a",
              "url" => "#{@site_host}/#{community.slug}/post/#{post_id}",
              "children" => [%{"text" => "Post reference"}]
            },
            %{
              "type" => "a",
              "url" => "#{@site_host}/#{community.slug}/blog/#{blog_id}",
              "children" => [%{"text" => "Blog reference"}]
            }
          ]
        }
      ])

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        post_id,
        mock_body_bag(body),
        user,
        Ecto.UUID.generate()
      )

    project_comment(comment)

    selected_locator = %{
      type: "COMMENT",
      article_inner_id: post_id,
      comment_inner_id: comment.inner_id
    }

    selected =
      gq_query(guest_conn, @mentioned_comment_query, %{
        community: community.slug,
        locator: selected_locator
      })

    assert selected["innerId"] == to_string(comment.inner_id)
    assert is_binary(selected["body"]["html"])

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^post.article_id),
      set: [state: :draft]
    )

    restricted_selected =
      gq_query(guest_conn, @mentioned_comment_query, %{
        community: community.slug,
        locator: selected_locator
      })

    assert restricted_selected["innerId"] == to_string(comment.inner_id)

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^post.article_id),
      set: [state: :published]
    )

    {:ok, second_comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        post_id,
        mock_body_bag(
          Jason.encode!([
            %{
              "type" => "p",
              "id" => "other-article-only",
              "children" => [
                %{
                  "type" => "a",
                  "url" => "#{@site_host}/#{community.slug}/blog/#{blog_id}",
                  "children" => [%{"text" => "Blog reference"}]
                }
              ]
            }
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    project_comment(second_comment)

    {:ok, unrelated} =
      CMS.Comments.create_comment(
        community,
        :post,
        post_id,
        mock_body_bag(
          Jason.encode!([
            %{"type" => "p", "id" => "plain", "children" => [%{"text" => "No reference"}]}
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    project_comment(unrelated)

    focus = %{type: "POST", article_inner_id: post_id}

    discovered =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus,
        first: 1
      })

    assert discovered["comments"] == [
             %{
               "type" => "COMMENT",
               "articleInnerId" => to_string(post_id),
               "commentInnerId" => to_string(comment.inner_id)
             }
           ]

    assert discovered["hasNextPage"] == true
    assert discovered["endCursor"] == to_string(comment.inner_id)
    refute String.contains?(Jason.encode!(discovered), "\"#{comment.id}\"")

    next_page =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus,
        first: 1,
        after: discovered["endCursor"]
      })

    assert next_page["comments"] == [
             %{
               "type" => "COMMENT",
               "articleInnerId" => to_string(post_id),
               "commentInnerId" => to_string(second_comment.inner_id)
             }
           ]

    assert is_boolean(next_page["hasNextPage"])

    {:ok, pending_comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        post_id,
        mock_body_bag(
          Jason.encode!([
            %{
              "type" => "p",
              "id" => "pending-comment",
              "children" => [%{"text" => "Not synchronized yet"}]
            }
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    pending_page =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus,
        after: to_string(second_comment.inner_id)
      })

    assert pending_page["comments"] == []

    pending_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: %{
          type: "COMMENT",
          article_inner_id: post_id,
          comment_inner_id: pending_comment.inner_id
        }
      })

    assert Enum.any?(pending_graph["nodes"], &(&1["type"] == "COMMENT"))

    second_focus = %{
      type: "COMMENT",
      article_inner_id: post_id,
      comment_inner_id: second_comment.inner_id
    }

    second_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: second_focus
      })

    assert Enum.any?(second_graph["nodes"], fn node ->
             node["type"] == "COMMENT" and
               node["locator"]["commentInnerId"] == to_string(second_comment.inner_id)
           end)

    assert Enum.any?(second_graph["nodes"], fn node ->
             node["type"] == "BLOG" and node["locator"]["articleInnerId"] == to_string(blog_id)
           end)

    assert length(second_graph["edges"]) == 1

    second_comment_node = Enum.find(second_graph["nodes"], &(&1["type"] == "COMMENT"))
    second_blog_node = Enum.find(second_graph["nodes"], &(&1["type"] == "BLOG"))

    assert Enum.any?(second_graph["edges"], fn edge ->
             edge["from"] == second_comment_node["id"] and edge["to"] == second_blog_node["id"]
           end)

    {:ok, mirror} = mock_community(user)

    assert {:ok, {:ok, _}} =
             Repo.transaction(fn ->
               CMS.Articles.BindingPersist.mirror(
                 Repo.get!(CMS.Model.Article, post.article_id),
                 mirror
               )
             end)

    mirror_focus = %{type: "POST", article_inner_id: article_inner_id(post, mirror)}

    mirror_page =
      gq_query(guest_conn, @article_comments_query, %{
        community: mirror.slug,
        focus: mirror_focus,
        first: 1
      })

    assert hd(mirror_page["comments"])["commentInnerId"] == to_string(comment.inner_id)

    assert hd(mirror_page["comments"])["articleInnerId"] ==
             to_string(article_inner_id(post, mirror))

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus,
        after: "invalid"
      })
    end

    comment_focus = %{
      type: "COMMENT",
      article_inner_id: post_id,
      comment_inner_id: comment.inner_id
    }

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: comment_focus
      })
    end

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: comment_focus
      })

    assert length(page["edges"]) == 2
    comment_node = Enum.find(page["nodes"], &(&1["type"] == "COMMENT"))
    post_node = Enum.find(page["nodes"], &(&1["type"] == "POST"))
    blog_node = Enum.find(page["nodes"], &(&1["type"] == "BLOG"))

    assert Enum.any?(
             page["edges"],
             &(&1["from"] == comment_node["id"] and
                 &1["to"] == post_node["id"])
           )

    assert Enum.any?(
             page["edges"],
             &(&1["from"] == comment_node["id"] and
                 &1["to"] == blog_node["id"])
           )

    project_comment(pending_comment)

    delete_command = Ecto.UUID.generate()

    assert {:ok, %{comment: _deleted}} =
             CMS.Comments.delete_comment_result(comment, user, delete_command, community.slug)

    after_delete =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus
      })

    # Soft deletion keeps the last published Comment relationships and their graph seed.
    assert Enum.map(after_delete["comments"], & &1["commentInnerId"]) ==
             Enum.map([comment, second_comment], &to_string(&1.inner_id))

    project_article(post)
    project_article(blog)

    deleted_graph_before_projection =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: comment_focus
      })

    assert length(deleted_graph_before_projection["edges"]) == 2
    assert Enum.any?(deleted_graph_before_projection["nodes"], &(&1["status"] == "DELETED"))

    project_comment(comment)

    deleted_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: comment_focus
      })

    assert length(deleted_graph["edges"]) == 2

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @mentioned_comment_query, %{
        community: community.slug,
        locator: comment_focus
      })
    end

    Repo.delete_all(
      from(binding in CMS.Model.ArticleBinding,
        where: binding.article_id == ^post.article_id
      )
    )

    stable_comment_focus = %{
      type: "COMMENT",
      article_id: post.article_id,
      comment_inner_id: comment.inner_id
    }

    stable_second_focus = %{
      type: "COMMENT",
      article_id: post.article_id,
      comment_inner_id: second_comment.inner_id
    }

    assert {:ok, [first_node, second_node]} =
             CMS.ArtimentMentions.MentionsGraph.NodeStatus.resolve_locators(
               community,
               [
                 %{stable_comment_focus | type: :comment},
                 %{stable_second_focus | type: :comment}
               ]
             )

    assert first_node.endpoint_id != second_node.endpoint_id
    assert first_node.id != second_node.id
    assert first_node.locator.comment_inner_id == comment.inner_id
    assert second_node.locator.comment_inner_id == second_comment.inner_id

    stable_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: stable_comment_focus
      })

    assert length(stable_graph["edges"]) >= 1
    stable_comment_node = Enum.find(stable_graph["nodes"], &(&1["id"] == first_node.id))

    assert stable_comment_node["url"] ==
             "/#{community.slug}/post/#{post.article_id}#comment-#{comment.inner_id}"

    assert stable_comment_node["id"] ==
             "comment:#{community.id}:post:id:#{post.article_id}:#{comment.inner_id}"

    assert stable_comment_node["locator"]["commentInnerId"] == to_string(comment.inner_id)

    stable_live_comment =
      gq_query(guest_conn, @mentioned_comment_query, %{
        community: community.slug,
        locator: %{
          type: "COMMENT",
          article_id: post.article_id,
          comment_inner_id: second_comment.inner_id
        }
      })

    assert stable_live_comment["innerId"] == to_string(second_comment.inner_id)

    stable_parent_focus = %{type: "POST", article_id: post.article_id}

    parent_page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: stable_parent_focus
      })

    assert Enum.any?(parent_page["nodes"], fn node ->
             node["type"] == "POST" and
               node["url"] == "/#{community.slug}/post/#{post.article_id}"
           end)
  end

  @tag :b2_independent
  test "Doc locator exposes no branch identity",
       %{guest_conn: guest_conn, community: community, user: user} do
    {_, doc, _, _} = mock_article(:doc, community, user)
    focus = %{type: "DOC", article_inner_id: article_inner_id(doc, community)}

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus
      })

    assert [%{"type" => "DOC", "locator" => %{"type" => "DOC"}}] = page["nodes"]
    public = Repo.get_by!(CMS.Model.DocPublic, article_id: doc.article_id)
    refute String.contains?(Jason.encode!(page), "\"#{public.branch_id}\"")
  end

  test "Doc main branch discovers its public Comment references",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_, doc, _, _} = mock_article(:doc, community, user)
    doc_id = article_inner_id(doc, community)
    blog_id = article_inner_id(blog, community)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        doc_id,
        mock_body_bag(
          Jason.encode!([
            %{
              "type" => "p",
              "id" => "doc-comment-ref",
              "children" => [
                %{
                  "type" => "a",
                  "url" => "#{@site_host}/#{community.slug}/blog/#{blog_id}",
                  "children" => [%{"text" => "Blog reference"}]
                }
              ]
            }
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    project_comment(comment)

    result =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: %{type: "DOC", article_inner_id: doc_id}
      })

    assert [%{"type" => "COMMENT", "commentInnerId" => public_id}] = result["comments"]
    assert public_id == to_string(comment.inner_id)

    graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: %{type: "COMMENT", article_inner_id: doc_id, comment_inner_id: comment.inner_id}
      })

    comment_node = Enum.find(graph["nodes"], &(&1["type"] == "COMMENT"))

    assert comment_node["url"] =~
             ~r{^/#{community.slug}/doc/#{doc_id}/[^/]+#comment-#{comment.inner_id}$}

    assert CMS.FrontDesk.comment_url(
             %{community_slug: community.slug, thread: :doc, article_id: doc.article_id},
             comment.inner_id
           ) == "/#{community.slug}/doc/#{doc.article_id}/doc#comment-#{comment.inner_id}"
  end

  @tag :b2_independent
  test "GraphQL Map responses are no-store", %{guest_conn: guest_conn} do
    conn = post(guest_conn, "/graphiql", query: "{ __typename }", variables: %{})
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  @tag :b2_independent
  test "directed adjacency paginates after public filtering and rejects a damaged cursor",
       %{guest_conn: guest_conn, community: community, blog: blog, post: post, user: user} do
    {_article, source_path} = published_source(community, blog, user, post)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    variables = %{community: community.slug, focus: focus, after: nil, first: 1}
    first_page = gq_query(guest_conn, @map_query, variables)
    assert first_page["hasNextPage"]
    assert is_binary(first_page["endCursor"])

    next_page =
      gq_query(guest_conn, @map_query, %{
        variables
        | after: first_page["endCursor"]
      })

    refute next_page["hasNextPage"]
    assert hd(first_page["edges"])["id"] != hd(next_page["edges"])["id"]

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @map_query, %{variables | after: "broken"})
    end
  end

  @tag :b2_independent
  test "a high fanout focus pages through more than one bounded fact window",
       %{guest_conn: guest_conn, community: community, user: user} do
    targets = for _ <- 1..45, do: elem(mock_article(:blog, community, user), 1)

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "many-references",
          "children" =>
            Enum.map(targets, fn target ->
              %{
                "type" => "a",
                "url" =>
                  "#{@site_host}/#{community.slug}/blog/#{article_inner_id(target, community)}",
                "children" => [%{"text" => "Blog reference"}]
              }
            end)
        }
      ])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        community,
        :post,
        %{title: "Many references", digest: "Fanout", body_bag: mock_body_bag(body)},
        user
      )

    assert {:ok, _} =
             CMS.Articles.publish(article.id, user,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: Ecto.UUID.generate()
             )

    project_article(article)

    focus = %{type: "POST", article_inner_id: article_inner_id(article, community)}

    pages =
      Enum.reduce_while(1..4, {nil, []}, fn _, {cursor, collected} ->
        page =
          gq_query(guest_conn, @map_query, %{
            community: community.slug,
            focus: focus,
            after: cursor,
            first: 20
          })

        edges = collected ++ page["edges"]

        if page["hasNextPage"] do
          {:cont, {page["endCursor"], edges}}
        else
          {:halt, {nil, edges}}
        end
      end)

    {cursor, edges} = pages
    assert cursor == nil
    assert length(edges) == 45
    assert length(Enum.uniq_by(edges, & &1["id"])) == 45

    source = %{
      type: :post,
      locator: %{type: :post, article_inner_id: article_inner_id(article, community)}
    }

    assert {:ok, first_mentions} =
             CMS.mentions(
               community.slug,
               source,
               %Params.Cursor{first: 20, after: nil}
             )

    assert length(first_mentions.entries) == 20
    assert first_mentions.page_info.has_next_page

    assert {:ok, second_mentions} =
             CMS.mentions(
               community.slug,
               source,
               %Params.Cursor{first: 20, after: first_mentions.page_info.end_cursor}
             )

    assert length(second_mentions.entries) == 20
    assert second_mentions.page_info.has_next_page

    assert {:ok, last_mentions} =
             CMS.mentions(
               community.slug,
               source,
               %Params.Cursor{first: 20, after: second_mentions.page_info.end_cursor}
             )

    assert length(last_mentions.entries) == 5
    refute last_mentions.page_info.has_next_page
  end

  @tag :b2_independent
  test "one-hop GraphQL offset counts and cursor pages share an exact bounded edge set",
       ctx do
    {_article, path} = published_source(ctx.community, ctx.blog, ctx.user, ctx.post)

    variables = %{
      community: ctx.community.slug,
      source: %{type: "POST", article_inner_id: path.inner_id}
    }

    offset =
      gq_query(
        ctx.guest_conn,
        @mentions_query,
        Map.put(variables, :pagi, %{offset: %{page: 1, size: 2}})
      )

    assert length(offset["entries"]) == 2
    assert offset["pageInfo"]["totalCount"] == 3
    assert offset["pageInfo"]["hasNextPage"]

    offset_last =
      gq_query(
        ctx.guest_conn,
        @mentions_query,
        Map.put(variables, :pagi, %{offset: %{page: 2, size: 2}})
      )

    assert length(offset_last["entries"]) == 1
    refute offset_last["pageInfo"]["hasNextPage"]

    {entries, _cursor} =
      Enum.reduce(1..3, {[], nil}, fn index, {entries, cursor} ->
        page =
          gq_query(
            ctx.guest_conn,
            @mentions_query,
            Map.put(variables, :pagi, %{cursor: %{first: 1, after: cursor}})
          )

        assert length(page["entries"]) == 1
        assert page["pageInfo"]["hasNextPage"] == index < 3
        {entries ++ page["entries"], page["pageInfo"]["endCursor"]}
      end)

    assert Enum.map(entries, & &1["id"]) ==
             Enum.map(offset["entries"] ++ offset_last["entries"], & &1["id"])

    assert length(Enum.uniq_by(entries, & &1["id"])) == 3
  end

  @tag :b2_independent
  test "one-hop GraphQL returns unavailable targets and hidden sources with metadata",
       ctx do
    {article, path} = published_source(ctx.community, ctx.blog, ctx.user)

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^ctx.blog.article_id),
      set: [state: :draft]
    )

    outgoing =
      gq_query(ctx.guest_conn, @mentions_query, %{
        community: ctx.community.slug,
        source: %{type: "POST", article_inner_id: path.inner_id},
        pagi: %{offset: %{page: 1, size: 20}}
      })

    assert outgoing["pageInfo"]["totalCount"] == 2

    assert %{"status" => "UNAVAILABLE", "url" => url} =
             Enum.find(outgoing["entries"], &(&1["targetType"] == "BLOG"))["target"]

    assert is_binary(url)

    refute Jason.encode!(outgoing) =~ ctx.blog.article_id

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^ctx.blog.article_id),
      set: [state: :published]
    )

    Repo.update_all(from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^article.id),
      set: [state: :draft]
    )

    incoming =
      gq_query(ctx.guest_conn, @mentioned_by_query, %{
        community: ctx.community.slug,
        target: %{
          type: "BLOG",
          locator: %{type: "BLOG", article_inner_id: article_inner_id(ctx.blog, ctx.community)}
        },
        pagi: %{offset: %{page: 1, size: 20}}
      })

    assert length(incoming["entries"]) == 1
    assert incoming["pageInfo"]["totalCount"] == 1
    assert hd(incoming["entries"])["source"]["status"] == "UNAVAILABLE"
  end

  @tag :b2_independent
  test "one-hop cursor cannot cross root, direction or global revision", ctx do
    {_article, path} = published_source(ctx.community, ctx.blog, ctx.user, ctx.post)

    variables = %{
      community: ctx.community.slug,
      source: %{type: "POST", article_inner_id: path.inner_id},
      pagi: %{cursor: %{first: 1}}
    }

    first = gq_query(ctx.guest_conn, @mentions_query, variables)
    cursor = first["pageInfo"]["endCursor"]
    assert is_binary(cursor)

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(ctx.guest_conn, @mentions_query, %{
        variables
        | source: %{type: "POST", article_inner_id: article_inner_id(ctx.post, ctx.community)},
          pagi: %{cursor: %{first: 1, after: cursor}}
      })
    end

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(ctx.guest_conn, @mentioned_by_query, %{
        community: ctx.community.slug,
        target: %{type: "POST", locator: variables.source},
        pagi: %{cursor: %{first: 1, after: cursor}}
      })
    end

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn -> ArtimentMentions.MentionsGraph.Revision.bump() end)

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(ctx.guest_conn, @mentions_query, %{
        variables
        | pagi: %{cursor: %{first: 1, after: cursor}}
      })
    end
  end

  @tag :b2_independent
  test "one-hop outgoing and incoming GraphQL record SQL counts for both pagination APIs",
       ctx do
    {_article, path} = published_source(ctx.community, ctx.blog, ctx.user, ctx.post)

    for pagination <- [%{offset: %{page: 1, size: 20}}, %{cursor: %{first: 20}}],
        {query, root} <- [
          {@mentions_query, %{source: %{type: "POST", article_inner_id: path.inner_id}}},
          {@mentioned_by_query,
           %{
             target: %{
               type: "BLOG",
               locator: %{
                 type: "BLOG",
                 article_inner_id: article_inner_id(ctx.blog, ctx.community)
               }
             }
           }}
        ] do
      ref = make_ref()
      handler = {__MODULE__, ref}

      :ok =
        :telemetry.attach(
          handler,
          [:groupher_server, :repo, :query],
          fn _, _, metadata, {pid, reference} ->
            if self() == pid, do: send(pid, {reference, metadata.query})
          end,
          {self(), ref}
        )

      try do
        result =
          gq_query(
            ctx.guest_conn,
            query,
            Map.merge(root, %{community: ctx.community.slug, pagi: pagination})
          )

        assert result["entries"] != []
        count = count_queries(ref, 0)
        assert count > 0
        IO.puts("B2 one-hop GraphQL SQL count: #{count}")
      after
        :telemetry.detach(handler)
      end
    end
  end

  @tag :b2_independent
  test "one-hop reads stored edges after a public revision changes", ctx do
    {article, path} = published_source(ctx.community, ctx.blog, ctx.user)
    public = Repo.get!(CMS.Model.ArticlePublic, article.id)

    public
    |> Ecto.Changeset.change(publication_version: public.publication_version + 1)
    |> Repo.update!()

    result =
      gq_query(ctx.guest_conn, @mentions_query, %{
        community: ctx.community.slug,
        source: %{type: "POST", article_inner_id: path.inner_id}
      })

    assert length(result["entries"]) == 2
  end

  @tag :b2_independent
  test "authenticated owners receive the same public graph and one-hop fields as guests", ctx do
    {_article, path} = published_source(ctx.community, ctx.blog, ctx.user)

    Repo.update_all(
      from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^ctx.blog.article_id),
      set: [state: :draft]
    )

    owner = simu_conn(:user, ctx.user)
    focus = %{type: "POST", article_inner_id: path.inner_id}
    graph_args = %{community: ctx.community.slug, focus: focus}

    assert gq_query(owner, @map_query, graph_args) ==
             gq_query(ctx.guest_conn, @map_query, graph_args)

    list_args = %{community: ctx.community.slug, source: focus}

    assert gq_query(owner, @mentions_query, list_args) ==
             gq_query(ctx.guest_conn, @mentions_query, list_args)
  end

  defp published_source(community, blog, user, other \\ nil) do
    extra =
      if other do
        [
          %{
            "type" => "a",
            "url" => "#{@site_host}/#{community.slug}/post/#{article_inner_id(other, community)}",
            "children" => [%{"text" => "Other post reference"}]
          }
        ]
      else
        []
      end

    body =
      Jason.encode!([
        %{
          "type" => "p",
          "id" => "reference",
          "children" =>
            [
              %{
                "type" => "a",
                "url" =>
                  "#{@site_host}/#{community.slug}/blog/#{article_inner_id(blog, community)}",
                "children" => [%{"text" => "Blog reference"}]
              },
              %{
                "type" => "a",
                "url" => "https://example.com/a",
                "children" => [%{"text" => "External reference"}]
              }
            ] ++ extra
        }
      ])

    {:ok, %{article: article, draft: draft}} =
      CMS.Articles.create_stable_draft(
        community,
        :post,
        %{title: "Reference source", digest: "Source", body_bag: mock_body_bag(body)},
        user
      )

    command_id = Ecto.UUID.generate()

    assert {:ok, _} =
             CMS.Articles.publish(article.id, user,
               community: community,
               expected_draft_version: draft.version,
               expected_lifecycle_version: 1,
               command_id: command_id
             )

    {article, %{inner_id: article_inner_id(article, community)}}
  end

  defp project_comment(comment) do
    endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    project_endpoint(endpoint)
  end

  defp project_article(article) do
    endpoint = Repo.get_by!(Endpoint, type: article.thread, article_id: article.id)
    project_endpoint(endpoint)
  end

  defp project_endpoint(endpoint) do
    assert %Endpoint{} = Repo.get!(Endpoint, endpoint.id)
  end
end
