defmodule GroupherServer.Test.CMS.MentionsGraphQueryTest do
  @moduledoc "Exercises the new public MentionsGraph query boundary."

  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Pagi, Repo}
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Model.{ArticleLifecycle, ArticlePublic}
  alias Pagi.Params

  @tag :stable_doc_identity
  test "Doc graph, one-hop list and Comment seeds share stable endpoints" do
    {community, doc, _attrs, user} = mock_article(:doc)
    {_, target, _, _} = mock_article(:blog, community, user)
    endpoint = Repo.get_by!(Endpoint, type: :doc, article_id: doc.article_id)

    public =
      Repo.get_by!(CMS.Model.DocPublic, article_id: doc.article_id, branch_id: doc.branch_id)

    token = "#{doc.branch_id}:#{public.branch_version_id}:#{public.publication_version + 1}"

    public
    |> Ecto.Changeset.change(publication_version: public.publication_version + 1)
    |> Repo.update!()

    ast = [
      %{
        "type" => "mention",
        "key" => "blog:#{target.article_id}",
        "children" => [%{"text" => "target"}]
      }
    ]

    assert {:ok, {:ok, captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :doc, article_id: doc.article_id},
                 %{
                   published_revision_identity: token,
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: public.updated_at
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    assert captured.source_endpoint_id == endpoint.id
    focus = %{type: :doc, article_inner_id: article_inner_id(doc, community)}
    assert {:ok, page} = CMS.mentions_graph_page(community.slug, focus, nil, 20)
    assert length(page.edges) == 1
    assert Enum.any?(page.nodes, &(&1.type == :doc))

    assert {:ok, list} =
             CMS.mentions(
               community.slug,
               %{type: :doc, locator: focus},
               %Params.Cursor{first: 20}
             )

    assert [%{source: %{type: :doc}, target: %{type: :blog}}] = list.entries

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :doc,
               focus.article_inner_id,
               mock_comment("Doc seed"),
               user,
               Ecto.UUID.generate()
             )

    comment_endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    assert comment_endpoint.parent_endpoint_id == endpoint.id
    assert {:ok, seeds} = CMS.mentions_graph_article_comments(community.slug, focus, nil, 20)
    assert seeds.comments == []

    assert {:ok, again} = CMS.mentions_graph_page(community.slug, focus, nil, 20)

    assert Enum.find(again.nodes, &(&1.type == :doc)).id ==
             Enum.find(page.nodes, &(&1.type == :doc)).id
  end

  @tag :b2_independent
  test "a readable source with no edges remains queryable" do
    {community, article, _attrs, _user} = mock_article(:post)

    assert %Endpoint{} = Repo.get_by(Endpoint, type: :post, article_id: article.article_id)

    focus = %{type: :post, article_inner_id: article_inner_id(article, community)}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 20)

    assert [%{status: :readable, can_open: true}] =
             page.nodes

    assert page.has_next_page == false
  end

  @tag :b2_independent
  test "a missing focus is rejected" do
    {community, _article, _attrs, _user} = mock_article(:post)
    missing = %{type: :post, article_inner_id: to_string(System.unique_integer([:positive]))}

    assert {:error, _} = CMS.mentions_graph_page(community.slug, missing, nil, 20)
  end

  test "a missing Comment row is unreadable and a graph edge to it fails with an integrity error" do
    {community, article, _attrs, _user} = mock_article(:post)
    source = Repo.get_by!(Endpoint, type: :post, article_id: article.article_id)
    missing_comment_id = (Repo.aggregate(CMS.Model.Comment, :max, :id) || 0) + 100

    orphan =
      %Endpoint{}
      |> Endpoint.changeset(%{
        type: :comment,
        comment_id: missing_comment_id,
        parent_endpoint_id: source.id
      })
      |> Repo.insert!()

    assert {:ok, statuses} =
             CMS.Artiment.Status.read_many(community, [
               %{key: orphan.id, type: :comment, comment_id: missing_comment_id}
             ])

    assert %{status: :unavailable, title: nil, url: nil, comment_inner_id: nil} =
             statuses[orphan.id]

    %Edge{}
    |> Edge.changeset(%{
      source_endpoint_id: source.id,
      target_type: :comment,
      target_endpoint_id: orphan.id,
      mention_case: :inline_mention,
      edge_key: "orphan-comment:#{orphan.id}",
      mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second),
      occurrences_count: 1
    })
    |> Repo.insert!()

    focus = %{type: :post, article_inner_id: article_inner_id(article, community)}

    assert {:error, %ErrorCat.Error{reason: :mentions_graph_integrity_error}} =
             CMS.mentions_graph_page(community.slug, focus, nil, 20)
  end

  test "restricted Comment status keeps a locator without exposing its body digest" do
    {community, article, _attrs, author} = mock_article(:post)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(article, community),
               mock_comment("private digest text"),
               author,
               Ecto.UUID.generate()
             )

    Repo.update_all(
      from(state in CMS.Model.CommentLifecycle, where: state.comment_id == ^comment.id),
      set: [state: :deleted]
    )

    assert {:ok, status} =
             CMS.Artiment.Status.read(community.slug, %{
               type: :comment,
               article_id: article.article_id,
               comment_inner_id: comment.inner_id
             })

    assert status.status == :deleted
    assert status.title == "评论 ##{comment.inner_id}"
    assert status.url =~ "#comment-#{comment.inner_id}"
  end

  test "a cross-Community Doc Comment uses its parent's Community for URL and review scope" do
    {source_community, source, _attrs, _author} = mock_article(:post)
    {target_community, doc, _attrs, author} = mock_article(:doc)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               target_community,
               :doc,
               doc.inner_id,
               mock_comment("cross community private text"),
               author,
               Ecto.UUID.generate()
             )

    assert {:ok, {:ok, _}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: [
                     %{
                       "type" => "mention",
                       "key" => "comment:#{comment.id}",
                       "children" => [%{"text" => "target"}]
                     }
                   ],
                   community_id: source_community.id,
                   mentioned_at: DateTime.utc_now(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    assert {:ok, _selected} =
             CMS.FrontDesk.Comment.read_mentioned(
               target_community.slug,
               %{
                 type: :comment,
                 article_id: doc.article_id,
                 comment_inner_id: comment.inner_id
               },
               nil
             )

    ref = %{key: comment.id, type: :comment, comment_id: comment.id}

    assert {:ok, statuses} = CMS.Artiment.Status.read_many(source_community, [ref])
    assert statuses[comment.id].status == :readable
    assert statuses[comment.id].url =~ "/#{target_community.slug}/doc/"

    %CMS.Model.CommentReviewBlock{}
    |> CMS.Model.CommentReviewBlock.changeset(%{
      comment_id: comment.id,
      community_id: target_community.id,
      type: :manual_hold,
      source_ref: "cross-community-review",
      source: :human,
      applied_at: DateTime.utc_now(:second)
    })
    |> Repo.insert!()

    assert {:ok, restricted} = CMS.Artiment.Status.read_many(source_community, [ref])
    assert restricted[comment.id].status == :unavailable
    refute String.contains?(restricted[comment.id].title, "private text")
  end

  test "a bound parent allows selected Comment reading with only an outgoing edge" do
    {community, parent, _attrs, author} = mock_article(:post)
    {_, target, _attrs, _} = mock_article(:blog, community, author)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(parent, community),
               mock_comment("outgoing only"),
               author,
               Ecto.UUID.generate()
             )

    comment_endpoint = Repo.get_by!(Endpoint, type: :comment, comment_id: comment.id)
    target_endpoint = Repo.get_by!(Endpoint, type: :blog, article_id: target.article_id)

    %Edge{}
    |> Edge.changeset(%{
      source_endpoint_id: comment_endpoint.id,
      target_type: :blog,
      target_endpoint_id: target_endpoint.id,
      mention_case: :inline_mention,
      edge_key: "outgoing-only:#{comment_endpoint.id}",
      mentioned_at: DateTime.utc_now(:second),
      occurrences_count: 1
    })
    |> Repo.insert!()

    assert {:ok, selected} =
             CMS.FrontDesk.Comment.read_mentioned(
               community.slug,
               %{
                 type: :comment,
                 article_id: parent.article_id,
                 comment_inner_id: comment.inner_id
               },
               nil
             )

    assert selected.id == comment.id
  end

  test "the Article Comment seed page excludes Comments without current edges" do
    {community, article, _attrs, user} = mock_article(:post)

    assert {:ok, _comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               article_inner_id(article, community),
               mock_comment("Comment without mentions"),
               user,
               Ecto.UUID.generate()
             )

    focus = %{type: :post, article_inner_id: article_inner_id(article, community)}

    assert {:ok, page} =
             CMS.mentions_graph_article_comments(community.slug, focus, nil, 20)

    assert page.comments == []
    refute page.has_next_page
  end

  @tag :b2_independent
  test "a stored internal edge is returned with its readable target" do
    {community, source, _attrs, user} = mock_article(:post)
    {_same_community, target, _target_attrs, _target_user} = mock_article(:blog, community, user)

    ast = [
      %{
        "type" => "mention",
        "key" => "blog:#{target.article_id}",
        "value" => "Mentioned target",
        "children" => [%{"text" => "linked target"}]
      }
    ]

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 20)

    assert length(page.nodes) == 2
    assert length(page.edges) == 1
    assert page.has_next_page == false
  end

  test "the focus page excludes relationships between neighboring Articles" do
    {community, article_a, _attrs, user} = mock_article(:post)
    {_, article_b, _, _} = mock_article(:blog, community, user)
    {_, article_c, _, _} = mock_article(:changelog, community, user)

    for {source, target} <- [{article_a, article_b}, {article_b, article_c}] do
      ast = [
        %{
          "type" => "mention",
          "key" => "#{target.thread}:#{target.article_id}",
          "children" => [%{"text" => "target"}]
        }
      ]

      assert {:ok, {:ok, _}} =
               Repo.transaction(fn ->
                 CMS.ArtimentMentions.Capture.execute(
                   %{type: source.thread, article_id: source.article_id},
                   %{
                     published_revision_identity: next_published_revision_identity(source),
                     ast: ast,
                     community_id: community.id,
                     mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                   },
                   {:command, Ecto.UUID.generate()}
                 )
               end)
    end

    focus = %{type: :post, article_inner_id: article_inner_id(article_a, community)}
    assert {:ok, page} = CMS.mentions_graph_page(community.slug, focus, nil, 20)
    assert length(page.edges) == 1
    assert Enum.map(page.nodes, & &1.type) |> Enum.sort() == [:blog, :post]
  end

  @tag :b2_independent
  test "one-hop lists use MentionsGraph entries for outgoing and incoming edges" do
    {community, source, _attrs, user} = mock_article(:post)
    {_same_community, target, _target_attrs, _target_user} = mock_article(:blog, community, user)

    ast = [
      %{
        "type" => "mention",
        "key" => "blog:#{target.article_id}",
        "value" => "Mentioned target",
        "children" => [%{"text" => "linked target"}]
      }
    ]

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    source_locator = %{type: :post, article_inner_id: article_inner_id(source, community)}
    target_locator = %{type: :blog, article_inner_id: article_inner_id(target, community)}

    assert {:ok, outgoing} =
             CMS.mentions(
               community.slug,
               %{type: :post, locator: source_locator},
               %Params.Cursor{first: 1, after: nil}
             )

    assert [
             %{
               source: %{type: :post, status: :readable},
               target: %{type: :blog, status: :readable}
             }
           ] =
             outgoing.entries

    assert outgoing.page_info.has_next_page == false

    assert {:ok, incoming} =
             CMS.mentioned_by(
               community.slug,
               %{type: :blog, locator: target_locator},
               %Params.Cursor{first: 1, after: nil}
             )

    assert [
             %{
               source: %{type: :post, status: :readable},
               target: %{type: :blog, status: :readable}
             }
           ] =
             incoming.entries
  end

  @tag :b2_independent
  test "one-hop lists preserve User targets and resolve incoming User mentions" do
    {community, source, _attrs, user} = mock_article(:post)
    token = next_published_revision_identity(source)

    ast = [
      %{
        "type" => "mention",
        "key" => "user:#{user.login}",
        "value" => user.login,
        "children" => [%{"text" => user.login}]
      }
    ]

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: token,
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    source_locator = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, outgoing} =
             CMS.mentions(
               community.slug,
               %{type: :post, locator: source_locator},
               %Params.Cursor{first: 20, after: nil}
             )

    assert [
             %{
               target_type: :user,
               target: %{__typename: :mention_user_target, status: :readable, login: login}
             }
           ] = outgoing.entries

    assert login == user.login

    assert {:ok, incoming} =
             CMS.mentioned_by(
               community.slug,
               %{type: :user, user_login: user.login},
               %Params.Cursor{first: 20, after: nil}
             )

    assert [%{source: %{type: :post, status: :readable}, target_type: :user}] =
             incoming.entries
  end

  @tag :b2_independent
  test "one-hop cursor pages reject cursors after the global revision changes" do
    {community, source, _attrs, user} = mock_article(:post)

    targets =
      for _ <- 1..2 do
        {_community, target, _attrs, _user} = mock_article(:blog, community, user)
        target
      end

    ast =
      Enum.map(targets, fn target ->
        %{
          "type" => "mention",
          "key" => "blog:#{target.article_id}",
          "value" => "Mentioned target",
          "children" => [%{"text" => "linked target"}]
        }
      end)

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    source_locator = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, first_page} =
             CMS.mentions(
               community.slug,
               %{type: :post, locator: source_locator},
               %Params.Cursor{first: 1, after: nil}
             )

    assert first_page.page_info.has_next_page
    cursor = first_page.page_info.end_cursor

    assert {:ok, {:error, %ErrorCat.Error{reason: :mentions_graph_invalid_cursor}}} =
             Repo.transaction(fn ->
               assert {:ok, :pass} = Revision.bump()

               CMS.mentions(
                 community.slug,
                 %{type: :post, locator: source_locator},
                 %Params.Cursor{first: 1, after: cursor}
               )
             end)
  end

  @tag :b2_independent
  test "a hidden target keeps its edge, title and URL" do
    {community, source, _attrs, user} = mock_article(:post)

    {_same_community, target, _target_attrs, _target_user} =
      mock_article(:blog, community, user)

    ast = [
      %{
        "type" => "mention",
        "key" => "blog:#{target.article_id}",
        "value" => "Mentioned target",
        "children" => [%{"text" => "linked target"}]
      }
    ]

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    Repo.update_all(
      from(lifecycle in ArticleLifecycle, where: lifecycle.article_id == ^target.article_id),
      set: [state: :draft]
    )

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 20)

    assert length(page.edges) == 1
    assert length(page.nodes) == 2

    assert Enum.any?(
             page.nodes,
             &(&1.status == :unavailable and is_binary(&1.url) and is_binary(&1.title))
           )
  end

  test "a Comment under a hidden parent keeps its edge, title and URL" do
    {community, source, _attrs, user} = mock_article(:post)

    {_same_community, parent, _parent_attrs, _parent_user} =
      mock_article(:blog, community, user)

    assert {:ok, comment} =
             CMS.Comments.create_comment(
               community,
               :blog,
               article_inner_id(parent, community),
               mock_comment("Comment whose parent becomes hidden"),
               user,
               Ecto.UUID.generate()
             )

    ast = [
      %{
        "type" => "mention",
        "key" => "comment:#{comment.id}",
        "value" => "Mentioned target",
        "children" => [%{"text" => "linked comment"}]
      }
    ]

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    Repo.update_all(
      from(lifecycle in ArticleLifecycle, where: lifecycle.article_id == ^parent.article_id),
      set: [state: :draft]
    )

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 20)

    assert length(page.edges) == 1
    # The parent's body is unavailable; the Comment retains its own readable status.
    assert Enum.any?(page.nodes, &(&1.type == :comment and &1.status == :readable))

    assert Enum.any?(
             page.nodes,
             &(&1.type == :comment and is_binary(&1.url) and is_binary(&1.title))
           )
  end

  @tag :b2_independent
  test "a focus takes one bounded page and counts SQL across the whole request" do
    {community, source, _attrs, user} = mock_article(:post)

    targets =
      for _ <- 1..25 do
        {_community, target, _target_attrs, _target_user} =
          mock_article(:blog, community, user)

        target
      end

    ast =
      Enum.map(targets, fn target ->
        %{
          "type" => "mention",
          "key" => "blog:#{target.article_id}",
          "value" => "Mentioned target",
          "children" => [%{"text" => "linked target"}]
        }
      end)

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}
    telemetry_ref = make_ref()
    telemetry_handler = {__MODULE__, telemetry_ref}

    :ok =
      :telemetry.attach(
        telemetry_handler,
        [:groupher_server, :repo, :query],
        fn _, _, metadata, {pid, ref} ->
          if self() == pid, do: send(pid, {ref, metadata.query})
        end,
        {self(), telemetry_ref}
      )

    try do
      assert {:ok, page} =
               CMS.mentions_graph_page(community.slug, focus, nil, 20)

      assert length(page.edges) == 20
      assert page.has_next_page
      queries = query_events(telemetry_ref, [])
      # A query per returned edge would issue at least 20 database calls.
      assert length(queries) < length(page.edges)
    after
      :telemetry.detach(telemetry_handler)
    end
  end

  @tag :b2_independent
  test "one focus keeps a restricted target and its status" do
    {community, focus_article, _attrs, user} = mock_article(:post)

    sources =
      [
        focus_article
        | for _ <- 1..9 do
            {_community, article, _attrs, _user} = mock_article(:blog, community, user)
            article
          end
      ]

    targets =
      for _ <- sources do
        {_community, target, _attrs, _user} = mock_article(:changelog, community, user)
        target
      end

    Enum.zip(sources, targets)
    |> Enum.each(fn {source, target} ->
      ast = [
        %{
          "type" => "mention",
          "key" => "changelog:#{target.article_id}",
          "value" => "Mentioned target",
          "children" => [%{"text" => "linked target"}]
        }
      ]

      assert {:ok, {:ok, _captured}} =
               Repo.transaction(fn ->
                 CMS.ArtimentMentions.Capture.execute(
                   %{type: source.thread, article_id: source.article_id},
                   %{
                     published_revision_identity: next_published_revision_identity(source),
                     ast: ast,
                     community_id: community.id,
                     mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                   },
                   {:command, Ecto.UUID.generate()}
                 )
               end)
    end)

    targets
    |> Enum.take(8)
    |> Enum.each(fn target ->
      Repo.update_all(
        from(lifecycle in ArticleLifecycle, where: lifecycle.article_id == ^target.article_id),
        set: [state: :draft]
      )
    end)

    focus = %{type: :post, article_inner_id: article_inner_id(focus_article, community)}

    assert {:ok, page} = CMS.mentions_graph_page(community.slug, focus, nil, 20)
    assert page.has_next_page == false
    assert length(page.edges) == 1
    assert Enum.count(page.nodes, &(&1.status == :unavailable)) == 1
  end

  @tag :b2_independent
  test "focus cursors return every edge once in stable order" do
    {community, source, _attrs, user} = mock_article(:post)

    targets =
      for _ <- 1..3 do
        {_community, target, _attrs, _user} = mock_article(:blog, community, user)
        target
      end

    ast =
      Enum.map(targets, fn target ->
        %{
          "type" => "mention",
          "key" => "blog:#{target.article_id}",
          "value" => "Mentioned target",
          "children" => [%{"text" => "linked target"}]
        }
      end)

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, first_page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 2)

    assert length(first_page.edges) == 2
    assert first_page.has_next_page
    cursor = first_page.end_cursor
    first_ids = MapSet.new(first_page.edges, & &1.id)

    assert {:ok, second_page} =
             CMS.mentions_graph_page(
               community.slug,
               focus,
               cursor,
               2
             )

    assert length(second_page.edges) == 1
    refute second_page.has_next_page
    refute Enum.any?(second_page.edges, &MapSet.member?(first_ids, &1.id))
  end

  @tag :b2_independent
  test "a cursor from an older graph revision is rejected" do
    {community, source, _attrs, user} = mock_article(:post)
    {_community, first_target, _attrs, _user} = mock_article(:blog, community, user)
    {_community, second_target, _attrs, _user} = mock_article(:blog, community, user)

    ast =
      [first_target, second_target]
      |> Enum.map(fn target ->
        %{
          "type" => "mention",
          "key" => "blog:#{target.article_id}",
          "value" => "Mentioned target",
          "children" => [%{"text" => "linked target"}]
        }
      end)

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    assert {:ok, first_page} =
             CMS.mentions_graph_page(community.slug, focus, nil, 1)

    assert first_page.has_next_page
    cursor = first_page.end_cursor

    assert {:ok, {:error, %ErrorCat.Error{reason: :mentions_graph_invalid_cursor}}} =
             Repo.transaction(fn ->
               assert {:ok, :pass} = Revision.bump()

               CMS.mentions_graph_page(
                 community.slug,
                 focus,
                 cursor,
                 1
               )
             end)
  end

  @tag :b2_independent
  test "a graph page is rejected when the global revision changes during the read" do
    {community, source, _attrs, _user} = mock_article(:post)
    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}
    ref = make_ref()
    handler = {__MODULE__, ref}
    revision_reads = :atomics.new(1, signed: false)

    :ok =
      :telemetry.attach(
        handler,
        [:groupher_server, :repo, :query],
        fn _, _, metadata, {pid, counter} ->
          if self() == pid and String.contains?(metadata.query, "mentions_graph_state") and
               not String.contains?(metadata.query, "set_config") and
               :atomics.add_get(counter, 1, 1) == 1 do
            assert {:ok, :pass} = Revision.bump()
          end
        end,
        {self(), revision_reads}
      )

    try do
      assert {:error, %ErrorCat.Error{reason: :mentions_graph_invalid_request}} =
               CMS.mentions_graph_page(community.slug, focus, nil, 20)
    after
      :telemetry.detach(handler)
    end
  end

  @tag :b2_independent
  test "a 3,000-edge neighborhood returns a bounded page using the source window index" do
    {community, source, _attrs, _user} = mock_article(:post)
    source_endpoint = Repo.get_by!(Endpoint, type: :post, article_id: source.article_id)

    assert {:ok, {:ok, _captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: [],
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    target_ids = Enum.map(1..3_000, fn _index -> Ecto.UUID.generate() end)

    Repo.insert_all(
      Endpoint,
      Enum.map(target_ids, fn article_id ->
        %{
          id: Ecto.UUID.generate(),
          type: :post,
          article_id: article_id,
          inserted_at: now,
          updated_at: now
        }
      end)
    )

    target_endpoints =
      Repo.all(from(endpoint in Endpoint, where: endpoint.article_id in ^target_ids))
      |> Map.new(&{&1.article_id, &1.id})

    edge_rows =
      target_ids
      |> Enum.with_index()
      |> Enum.map(fn {article_id, index} ->
        %{
          id: Ecto.UUID.generate(),
          source_endpoint_id: source_endpoint.id,
          target_type: :post,
          target_endpoint_id: Map.fetch!(target_endpoints, article_id),
          mention_case: :inline_mention,
          edge_key: "#{String.pad_leading(Integer.to_string(index), 5, "0")}:#{article_id}",
          mentioned_at: now,
          occurrences_count: 1,
          inserted_at: now,
          updated_at: now
        }
      end)

    assert {3_000, nil} = Repo.insert_all(Edge, edge_rows)
    assert {:ok, {:ok, :pass}} = Repo.transaction(fn -> Revision.bump() end)

    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}

    {result, graph_evidence} =
      explain_request(fn ->
        CMS.mentions_graph_page(community.slug, focus, nil, 20)
      end)

    assert {:ok, page} = result

    {list_result, list_evidence} =
      explain_request(fn ->
        CMS.mentions(
          community.slug,
          %{type: :post, locator: focus},
          %Params.Cursor{first: 20}
        )
      end)

    assert {:ok, list_page} = list_result
    assert length(list_page.entries) == 20
    assert list_page.page_info.has_next_page
    assert Jason.encode!(graph_evidence.full_adjacency_plans) =~ "mention_current_edge_"

    IO.puts(
      "B2 complete query evidence: " <>
        Jason.encode!(%{
          graph: Map.drop(graph_evidence, [:full_adjacency_plans]),
          one_hop: Map.drop(list_evidence, [:full_adjacency_plans])
        })
    )

    if directory = System.get_env("CMS_MENTIONS_B2_EVIDENCE_DIR") do
      File.mkdir_p!(directory)

      File.write!(
        Path.join(directory, "synthetic-3000-full-plans.json"),
        Jason.encode!(%{graph: graph_evidence, one_hop: list_evidence}, pretty: true)
      )
    end

    assert length(page.edges) == 20
    assert page.has_next_page

    edge_query =
      from(edge in Edge,
        where: edge.source_endpoint_id == ^source_endpoint.id,
        order_by: [asc: edge.edge_key],
        limit: 21
      )

    plan = Repo.explain(:all, edge_query, analyze: true, buffers: true)
    assert plan =~ "mention_current_edge_source_window_index"
    assert plan =~ "Limit"
  end

  @tag :b2_independent
  test "bounded directional merge deduplicates a self edge across cursor pages" do
    {community, source, _, user} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, user)

    ast =
      Enum.map([{"post", source.article_id}, {"blog", target.article_id}], fn {thread, id} ->
        %{
          "type" => "mention",
          "key" => "#{thread}:#{id}",
          "children" => [%{"text" => "reference"}]
        }
      end)

    assert {:ok, {:ok, _}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :post, article_id: source.article_id},
                 %{
                   published_revision_identity: next_published_revision_identity(source),
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: DateTime.utc_now(:second)
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    # Exercise read-side UNION deduplication independently of Parser self-reference policy.
    edge = Repo.one!(Edge)

    attrs =
      edge
      |> Map.from_struct()
      |> Map.take([
        :source_endpoint_id,
        :mentioned_at,
        :occurrences_count,
        :mention_case
      ])

    attrs =
      Map.merge(attrs, %{
        target_type: :post,
        target_endpoint_id: edge.source_endpoint_id,
        edge_key: "self-loop-merge-test"
      })

    Repo.insert!(Edge.changeset(%Edge{}, attrs))
    assert length(Repo.all(Edge)) == 2
    focus = %{type: :post, article_inner_id: article_inner_id(source, community)}
    assert {:ok, first} = CMS.mentions_graph_page(community.slug, focus, nil, 1)
    assert first.has_next_page

    assert {:ok, second} =
             CMS.mentions_graph_page(
               community.slug,
               focus,
               first.end_cursor,
               1
             )

    assert length(first.edges) == 1
    assert length(second.edges) == 1
    assert length(Enum.uniq_by(first.edges ++ second.edges, & &1.id)) == 2
    refute second.has_next_page
  end

  @tag :b2_independent
  test "Doc main graph and one-hop keep stable identity without Comment runtime" do
    {community, doc, _attrs, user} = mock_article(:doc)
    {_, target, _, _} = mock_article(:blog, community, user)
    endpoint = Repo.get_by!(Endpoint, type: :doc, article_id: doc.article_id)

    public =
      Repo.get_by!(CMS.Model.DocPublic, article_id: doc.article_id, branch_id: doc.branch_id)

    token = "#{doc.branch_id}:#{public.branch_version_id}:#{public.publication_version + 1}"

    public
    |> Ecto.Changeset.change(publication_version: public.publication_version + 1)
    |> Repo.update!()

    ast = [
      %{
        "type" => "mention",
        "key" => "blog:#{target.article_id}",
        "children" => [%{"text" => "target"}]
      }
    ]

    assert {:ok, {:ok, captured}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.Capture.execute(
                 %{type: :doc, article_id: doc.article_id},
                 %{
                   published_revision_identity: token,
                   ast: ast,
                   community_id: community.id,
                   mentioned_at: public.updated_at
                 },
                 {:command, Ecto.UUID.generate()}
               )
             end)

    assert captured.source_endpoint_id == endpoint.id
    focus = %{type: :doc, article_inner_id: article_inner_id(doc, community)}
    assert {:ok, page} = CMS.mentions_graph_page(community.slug, focus, nil, 20)
    assert length(page.edges) == 1
    assert Enum.any?(page.nodes, &(&1.type == :doc))

    assert {:ok, list} =
             CMS.mentions(
               community.slug,
               %{type: :doc, locator: focus},
               %Params.Cursor{first: 20}
             )

    assert [%{source: %{type: :doc}, target: %{type: :blog}}] = list.entries
  end

  defp explain_request(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}

    :ok =
      :telemetry.attach(
        handler,
        [:groupher_server, :repo, :query],
        fn _, _, metadata, {pid, ref} ->
          if self() == pid, do: send(pid, {ref, metadata})
        end,
        {self(), ref}
      )

    {elapsed_us, result} = :timer.tc(fun)
    :telemetry.detach(handler)
    statements = statement_events(ref, [])

    plans =
      statements
      |> Enum.filter(
        &(String.contains?(&1.query, ~s(FROM "cms"."mention_current_edges")) and
            String.contains?(&1.query, "LIMIT"))
      )
      |> Enum.map(fn statement ->
        %{rows: [[plan]]} =
          Ecto.Adapters.SQL.query!(
            Repo,
            "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " <> statement.query,
            statement.params
          )

        plan
      end)

    assert plans != []

    {result,
     %{elapsed_ms: elapsed_us / 1000, sql_count: length(statements), full_adjacency_plans: plans}}
  end

  defp statement_events(ref, acc) do
    receive do
      {^ref, metadata} ->
        if String.downcase(String.trim(metadata.query)) in ["begin", "commit", "rollback"] do
          statement_events(ref, acc)
        else
          statement_events(ref, [metadata | acc])
        end
    after
      0 -> Enum.reverse(acc)
    end
  end

  defp next_published_revision_identity(article) do
    public = Repo.get!(ArticlePublic, article.article_id)
    next_version = public.publication_version + 1

    public
    |> Ecto.Changeset.change(publication_version: next_version)
    |> Repo.update!()

    "#{public.revision_id}:#{next_version}"
  end

  defp query_events(ref, acc) do
    receive do
      {^ref, query} ->
        if String.downcase(String.trim(query)) in ["begin", "commit", "rollback"] do
          query_events(ref, acc)
        else
          query_events(ref, [query | acc])
        end
    after
      0 -> Enum.reverse(acc)
    end
  end
end
