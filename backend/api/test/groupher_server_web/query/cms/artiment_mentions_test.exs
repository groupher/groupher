defmodule GroupherServer.Test.Query.CMS.ArtimentMentions do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions

  @site_host ArtimentMentions.Config.site_host()
  @mentions_query S.Mention.q(:mentions)
  @mentioned_by_query S.Mention.q(:mentioned_by)
  @map_query """
  query($community: String!, $focus: ReferenceMapLocatorInput!,
        $frontiers: [ReferenceMapFrontierInput!]!, $first: Int) {
    referenceMap(community: $community, focus: $focus, frontiers: $frontiers, first: $first) {
      nodes { id type articleInnerId commentInnerId branchId title url syncState }
      edges { id from to occurrencesCount }
      neighborhoods { requestIndex state nodeId edgeIds hasNextPage endCursor }
      projectionPending
    }
  }
  """
  @article_comments_query """
  query($community: String!, $focus: ReferenceMapLocatorInput!, $after: ID, $first: Int) {
    referenceMapArticleComments(community: $community, focus: $focus, after: $after, first: $first) {
      comments { type articleInnerId commentInnerId }
      hasNextPage
      endCursor
    }
  }
  """

  setup do
    {community, post, _attrs, user} = mock_article(:post)
    {_, blog, _, _} = mock_article(:blog, community, user)

    {:ok,
     %{guest_conn: simu_conn(:guest), community: community, post: post, blog: blog, user: user}}
  end

  test "public one-hop queries expose opaque identity and current Community paths",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)

    mentions =
      guest_conn
      |> gq_query(@mentions_query, %{
        community: community.slug,
        source: %{article: source_path},
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert mentions["pageInfo"]["totalCount"] == 2
    internal = Enum.find(mentions["entries"], &(&1["mentionedType"] == "BLOG"))
    assert String.starts_with?(internal["id"], "v1_")
    assert internal["mentionerUrl"] == "/#{community.slug}/post/#{source_path.inner_id}"

    assert internal["mentionedUrl"] ==
             "/#{community.slug}/blog/#{article_inner_id(blog, community)}"

    assert internal["occurrencesCount"] == 1

    external = Enum.find(mentions["entries"], &(&1["mentionedType"] == "URL"))
    assert external["mentionedUrl"] == "https://example.com/a"

    encoded = Jason.encode!(mentions)
    refute String.contains?(encoded, article.id)
    refute String.contains?(encoded, blog.article_id)

    incoming =
      guest_conn
      |> gq_query(@mentioned_by_query, %{
        community: community.slug,
        target: %{
          article: %{
            community: community.slug,
            thread: "BLOG",
            inner_id: article_inner_id(blog, community)
          }
        },
        pagi: %{offset: %{page: 1, size: 10}}
      })

    assert incoming["pageInfo"]["totalCount"] == 1
    assert hd(incoming["entries"])["id"] == internal["id"]
  end

  test "a mismatched root Community cannot read another Community's locator",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_article, source_path} = published_source(community, blog, user)
    {:ok, other} = mock_community(user)

    assert_raise ExUnit.AssertionError, ~r/GraphQL operation mentions returned errors/, fn ->
      gq_query(guest_conn, @mentions_query, %{
        community: other.slug,
        source: %{article: source_path}
      })
    end
  end

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
            %{"text" => "#{@site_host}/#{community.slug}/ticket/#{published_ticket.inner_id}"}
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

    event = Repo.get_by!(CMS.Outbox.Event, event: "article.mention_sync", command_id: command_id)

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxArticle.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    source_path = %{
      community: community.slug,
      thread: "POST",
      inner_id: article_inner_id(article, community)
    }

    target_path = %{community: community.slug, inner_id: published_ticket.inner_id}

    outgoing =
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{article: source_path}
      })

    assert [%{"mentionedType" => "TICKET", "mentionedUrl" => ticket_url}] =
             outgoing["entries"]

    assert ticket_url == "/#{community.slug}/ticket/#{published_ticket.inner_id}"

    incoming =
      gq_query(guest_conn, @mentioned_by_query, %{
        community: community.slug,
        target: %{ticket: target_path}
      })

    assert incoming["pageInfo"]["totalCount"] == 1
    assert hd(incoming["entries"])["id"] == hd(outgoing["entries"])["id"]

    ticket_root =
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{ticket: target_path}
      })

    assert ticket_root["pageInfo"]["totalCount"] == 0

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @mentions_query, %{
        community: community.slug,
        source: %{ticket: %{community: community.slug, inner_id: 999_999}}
      })
    end
  end

  test "public map returns directed opaque adjacency and current paths",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}

    result =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}],
        first: 1
      })

    page = result
    assert length(page["nodes"]) == 2
    assert [edge] = page["edges"]
    assert edge["occurrencesCount"] == 1
    assert String.starts_with?(edge["id"], "v1_")
    assert [neighborhood] = page["neighborhoods"]
    assert neighborhood["hasNextPage"] == false
    assert neighborhood["edgeIds"] == [edge["id"]]

    revision =
      gq_query(
        guest_conn,
        """
        query($community: String!, $focus: ReferenceMapLocatorInput!) {
          referenceMapRevision(community: $community, focus: $focus)
        }
        """,
        %{community: community.slug, focus: focus}
      )

    assert String.starts_with?(revision, "v1_")

    encoded = Jason.encode!(page)
    refute String.contains?(encoded, article.id)
    refute String.contains?(encoded, blog.article_id)
  end

  test "map stays within the single-frontier SQL budget",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {_article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    ref = make_ref()
    handler = "reference-map-query-count-#{System.unique_integer([:positive])}"

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
      _page =
        gq_query(guest_conn, @map_query, %{
          community: community.slug,
          focus: focus,
          frontiers: [%{node: focus}]
        })

      assert count_queries(ref, 0) <= 32
    after
      :telemetry.detach(handler)
    end
  end

  test "ten frontiers use the same bounded public read batch",
       %{guest_conn: guest_conn, community: community, post: post, blog: blog, user: user} do
    {_source, source_path} = published_source(community, blog, user)
    more = for _ <- 1..7, do: elem(mock_article(:post, community, user), 1)
    articles = [post, blog | more]
    focus = %{type: "POST", article_inner_id: source_path.inner_id}

    frontiers = [
      %{node: focus}
      | Enum.map(articles, fn article ->
          %{
            node: %{
              type: String.upcase(to_string(article.thread)),
              article_inner_id: article_inner_id(article, community)
            }
          }
        end)
    ]

    assert length(frontiers) == 10

    ref = make_ref()
    handler = "reference-map-ten-query-count-#{System.unique_integer([:positive])}"

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
          frontiers: frontiers,
          first: 2
        })

      assert length(page["neighborhoods"]) == 10
      assert count_queries(ref, 0) <= 32
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

  test "a lagging source hides old edges and marks the public page pending",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    state = Repo.get_by!(CMS.ArtimentMentions.Model.SyncState, source_article_id: article.id)

    state
    |> Ecto.Changeset.change(desired_content_token: "new-public-version")
    |> Repo.update!()

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}]
      })

    assert page["edges"] == []
    assert page["projectionPending"] == true
    assert [%{"syncState" => "PENDING"}] = page["nodes"]
  end

  test "missing watermark and canonical drift keep a readable frontier pending",
       %{guest_conn: guest_conn, community: community, blog: blog, user: user} do
    {article, source_path} = published_source(community, blog, user)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    request = %{community: community.slug, focus: focus, frontiers: [%{node: focus}]}
    state = Repo.get_by!(CMS.ArtimentMentions.Model.SyncState, source_article_id: article.id)

    public = Repo.get!(CMS.Model.ArticlePublic, article.id)

    public
    |> Ecto.Changeset.change(publication_version: public.publication_version + 1)
    |> Repo.update!()

    drift = gq_query(guest_conn, @map_query, request)
    assert drift["projectionPending"]
    assert [%{"syncState" => "PENDING"}] = drift["nodes"]

    Repo.delete!(state)
    missing = gq_query(guest_conn, @map_query, request)
    assert missing["projectionPending"]
    assert [%{"syncState" => "PENDING"}] = missing["nodes"]
  end

  test "an unrequested public Comment with no synced watermark marks its Community pending",
       %{guest_conn: guest_conn, community: community, post: post, blog: blog, user: user} do
    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment("Pending outside the requested frontier"),
        user,
        Ecto.UUID.generate()
      )

    assert %CMS.ArtimentMentions.Model.SyncState{synced_content_token: nil} =
             Repo.get_by!(CMS.ArtimentMentions.Model.SyncState, source_comment_id: comment.id)

    focus = %{type: "BLOG", article_inner_id: article_inner_id(blog, community)}

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}]
      })

    assert page["projectionPending"] == true
  end

  test "duplicate frontier inputs are rejected", %{
    guest_conn: guest_conn,
    community: community,
    post: post
  } do
    focus = %{type: "POST", article_inner_id: article_inner_id(post, community)}

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}, %{node: focus}]
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

    assert {:ok, _} =
             CMS.Comments.Effects.deliver(
               :sync_mentions,
               %{"comment_id" => comment.id}
             )

    focus = %{
      type: "COMMENT",
      article_inner_id: article_inner_id(post, community),
      comment_inner_id: comment.inner_id
    }

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}]
      })

    assert [
             %{
               "type" => "COMMENT",
               "branchId" => nil,
               "commentInnerId" => public_id,
               "url" => url
             }
           ] = page["nodes"]

    assert public_id == to_string(comment.inner_id)

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
            %{"text" => "#{@site_host}/#{community.slug}/post/#{post_id}"},
            %{"text" => " #{@site_host}/#{community.slug}/blog/#{blog_id}"}
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

    assert {:ok, _} = CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => comment.id})

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
              "children" => [%{"text" => "#{@site_host}/#{community.slug}/blog/#{blog_id}"}]
            }
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    assert {:ok, _} =
             CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => second_comment.id})

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

    assert {:ok, _} =
             CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => unrelated.id})

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

    assert next_page["hasNextPage"] == false

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

    assert [%{"commentInnerId" => pending_public_id}] = pending_page["comments"]
    assert pending_public_id == to_string(pending_comment.inner_id)

    pending_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [
          %{
            node: %{
              type: "COMMENT",
              article_inner_id: post_id,
              comment_inner_id: pending_comment.inner_id
            }
          }
        ]
      })

    assert pending_graph["projectionPending"] == true
    assert [%{"syncState" => "PENDING"}] = pending_graph["nodes"]

    second_focus = %{
      type: "COMMENT",
      article_inner_id: post_id,
      comment_inner_id: second_comment.inner_id
    }

    second_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: second_focus}]
      })

    assert [%{"type" => "COMMENT"}, %{"type" => "BLOG"}] =
             Enum.sort_by(second_graph["nodes"], &(&1["type"] != "COMMENT"))

    assert length(second_graph["edges"]) == 1

    {:ok, mirror} = mock_community(user)

    assert {:ok, _} =
             CMS.Articles.BindingPersist.mirror(
               Repo.get!(CMS.Model.Article, post.article_id),
               mirror
             )

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
        focus: focus,
        frontiers: [%{node: comment_focus}]
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

    assert {:ok, :pass} =
             CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => pending_comment.id})

    delete_command = Ecto.UUID.generate()

    assert {:ok, %{comment: _deleted}} =
             CMS.Comments.delete_comment_result(comment, user, delete_command, community.slug)

    event =
      Repo.get_by!(CMS.Outbox.Event,
        event: "comment.mention_sync",
        resource_id: to_string(comment.id),
        command_id: delete_command
      )

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxComment.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    after_delete =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: focus
      })

    assert Enum.map(after_delete["comments"], & &1["commentInnerId"]) ==
             [to_string(second_comment.inner_id)]

    assert {:ok, _} =
             ArtimentMentions.sync_current(%{type: :post, article_id: post.article_id})

    assert {:ok, _} =
             ArtimentMentions.sync_current(%{type: :blog, article_id: blog.article_id})

    deleted_graph =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: comment_focus}]
      })

    assert deleted_graph["edges"] == []
    assert deleted_graph["projectionPending"] == false
  end

  test "Doc branch identity is opaque in the public node",
       %{guest_conn: guest_conn, community: community, user: user} do
    {_, doc, _, _} = mock_article(:doc, community, user)
    focus = %{type: "DOC", article_inner_id: article_inner_id(doc, community)}

    page =
      gq_query(guest_conn, @map_query, %{
        community: community.slug,
        focus: focus,
        frontiers: [%{node: focus}]
      })

    assert [%{"type" => "DOC", "branchId" => branch_id}] = page["nodes"]
    assert String.starts_with?(branch_id, "v1_")
    public = Repo.get_by!(CMS.Model.DocPublic, article_id: doc.article_id)
    refute branch_id == to_string(public.branch_id)
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
              "children" => [%{"text" => "#{@site_host}/#{community.slug}/blog/#{blog_id}"}]
            }
          ])
        ),
        user,
        Ecto.UUID.generate()
      )

    assert {:ok, _} = CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => comment.id})

    result =
      gq_query(guest_conn, @article_comments_query, %{
        community: community.slug,
        focus: %{type: "DOC", article_inner_id: doc_id}
      })

    assert [%{"type" => "COMMENT", "commentInnerId" => public_id}] = result["comments"]
    assert public_id == to_string(comment.inner_id)
  end

  test "GraphQL Map responses are no-store", %{guest_conn: guest_conn} do
    conn = post(guest_conn, "/graphiql", query: "{ __typename }", variables: %{})
    assert get_resp_header(conn, "cache-control") == ["no-store"]
  end

  test "directed adjacency paginates after public filtering and rejects a damaged cursor",
       %{guest_conn: guest_conn, community: community, blog: blog, post: post, user: user} do
    {_article, source_path} = published_source(community, blog, user, post)
    focus = %{type: "POST", article_inner_id: source_path.inner_id}
    variables = %{community: community.slug, focus: focus, frontiers: [%{node: focus}], first: 1}
    first_page = gq_query(guest_conn, @map_query, variables)
    first_neighborhood = hd(first_page["neighborhoods"])
    assert first_neighborhood["hasNextPage"]
    assert is_binary(first_neighborhood["endCursor"])

    next_page =
      gq_query(guest_conn, @map_query, %{
        variables
        | frontiers: [%{node: focus, after: first_neighborhood["endCursor"]}]
      })

    refute hd(next_page["neighborhoods"])["hasNextPage"]
    assert hd(first_page["edges"])["id"] != hd(next_page["edges"])["id"]

    assert_raise ExUnit.AssertionError, ~r/returned errors/, fn ->
      gq_query(guest_conn, @map_query, %{variables | frontiers: [%{node: focus, after: "broken"}]})
    end
  end

  test "a high fanout frontier pages through more than one bounded fact window",
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
                "text" =>
                  " #{@site_host}/#{community.slug}/blog/#{article_inner_id(target, community)}"
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

    assert {:ok, {45, nil}} =
             ArtimentMentions.sync_current(%{type: :post, article_id: article.id})

    focus = %{type: "POST", article_inner_id: article_inner_id(article, community)}

    pages =
      Enum.reduce_while(1..4, {nil, []}, fn _, {cursor, collected} ->
        frontier = if cursor, do: %{node: focus, after: cursor}, else: %{node: focus}

        page =
          gq_query(guest_conn, @map_query, %{
            community: community.slug,
            focus: focus,
            frontiers: [frontier],
            first: 20
          })

        neighborhood = hd(page["neighborhoods"])
        edges = collected ++ page["edges"]

        if neighborhood["hasNextPage"] do
          {:cont, {neighborhood["endCursor"], edges}}
        else
          {:halt, {nil, edges}}
        end
      end)

    {cursor, edges} = pages
    assert cursor == nil
    assert length(edges) == 45
    assert length(Enum.uniq_by(edges, & &1["id"])) == 45

    source = %{
      article: %{
        community: community.slug,
        thread: :post,
        inner_id: article_inner_id(article, community)
      }
    }

    assert {:ok, first_mentions} =
             ArtimentMentions.public_mentions(
               community.slug,
               source,
               %GroupherServer.Pagi.Params.Cursor{first: 20}
             )

    assert length(first_mentions.entries) == 20
    assert first_mentions.has_next_page

    assert {:ok, second_mentions} =
             ArtimentMentions.public_mentions(
               community.slug,
               source,
               %GroupherServer.Pagi.Params.Cursor{
                 first: 20,
                 after: first_mentions.end_cursor
               }
             )

    assert length(second_mentions.entries) == 20
    assert second_mentions.has_next_page

    assert {:ok, last_mentions} =
             ArtimentMentions.public_mentions(
               community.slug,
               source,
               %GroupherServer.Pagi.Params.Cursor{
                 first: 20,
                 after: second_mentions.end_cursor
               }
             )

    assert length(last_mentions.entries) == 5
    refute last_mentions.has_next_page
  end

  defp published_source(community, blog, user, other \\ nil) do
    extra =
      if other do
        [
          %{
            "text" =>
              " #{@site_host}/#{community.slug}/post/#{article_inner_id(other, community)}"
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
                "text" =>
                  "#{@site_host}/#{community.slug}/blog/#{article_inner_id(blog, community)}"
              },
              %{"text" => " https://example.com/a"}
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

    event = Repo.get_by!(CMS.Outbox.Event, event: "article.mention_sync", command_id: command_id)

    assert {:ok, :pass} =
             GroupherServer.Jobs.CMSOutboxArticle.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 3
             })

    {article,
     %{community: community.slug, thread: "POST", inner_id: article_inner_id(article, community)}}
  end
end
