defmodule GroupherServer.Test.CMS.ArtimentMentionsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false
  import Ecto.Query
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions
  alias CMS.ArtimentMentions.GraphRevision
  alias CMS.ArtimentMentions.Opaque
  alias CMS.ArtimentMentions.Rebuild
  alias CMS.ArtimentMentions.PublicUrl
  alias CMS.ArtimentMentions.Model.SyncState
  alias CMS.Model.{Article, ArtimentMention}

  @site_host CMS.ArtimentMentions.Config.site_host()

  setup do
    {community, post, post_attrs, user} = mock_article(:post, preload: [author: :user])
    {_, blog, _, _} = mock_article(:blog, community, user)
    {_, changelog, _, _} = mock_article(:changelog, community, user)
    {:ok, mentioned_user} = db_insert(:user)

    {:ok, ~m(community post post_attrs blog changelog user mentioned_user)a}
  end

  test "rotating the Map signing key changes opaque identities and revision digests",
       ~m(community post)a do
    old_key = Application.fetch_env!(:groupher_server, :reference_map_key)
    old_version = Application.fetch_env!(:groupher_server, :reference_map_key_version)

    on_exit(fn ->
      Application.put_env(:groupher_server, :reference_map_key, old_key)
      Application.put_env(:groupher_server, :reference_map_key_version, old_version)
    end)

    node_key = {:post, post.article_id, nil, nil}
    old_node = Opaque.id(:node, community.id, node_key)
    old_revision = Opaque.id(:revision, community.id, 1)

    Application.put_env(
      :groupher_server,
      :reference_map_key,
      "rotated-reference-map-key-with-at-least-32-bytes"
    )

    Application.put_env(:groupher_server, :reference_map_key_version, old_version + 1)

    refute Opaque.id(:node, community.id, node_key) == old_node
    refute Opaque.id(:revision, community.id, 1) == old_revision
  end

  test "rebuild still reports a live Comment whose body is missing", ~m(community post user)a do
    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_body_bag(plate_body([block("comment", [text("current body")])])),
        user,
        Ecto.UUID.generate()
      )

    Repo.delete_all(from(body in CMS.Model.CommentBody, where: body.comment_id == ^comment.id))

    source_key = Rebuild.key(%{type: :comment, comment_id: comment.id})
    assert Enum.any?(Rebuild.report(nil, 100).issues, &(&1.source_key == source_key))

    manifest =
      Path.join(System.tmp_dir!(), "mention-rebuild-missing-body-#{comment.id}.json")

    on_exit(fn -> File.rm(manifest) end)
    result = Rebuild.apply(nil, 100, false, manifest)
    assert Enum.any?(result.failures, &(&1["source_key"] == source_key))
  end

  test "failure manifest records a category without leaking invalid Comment body",
       ~m(community post user)a do
    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_body_bag(plate_body([block("comment", [text("valid body")])])),
        user,
        Ecto.UUID.generate()
      )

    Repo.update_all(
      from(body in CMS.Model.CommentBody, where: body.comment_id == ^comment.id),
      set: [json: "{private-body-marker"]
    )

    manifest =
      Path.join(System.tmp_dir!(), "mention-rebuild-invalid-body-#{comment.id}.json")

    on_exit(fn -> File.rm(manifest) end)
    result = Rebuild.apply(nil, 100, true, manifest)
    source_key = Rebuild.key(%{type: :comment, comment_id: comment.id})

    assert Enum.any?(result.failures, fn failure ->
             failure["source_key"] == source_key and failure["category"] == "invalid_json"
           end)

    refute File.read!(manifest) =~ "private-body-marker"
  end

  test "rebuild traverses every keyset page and resumes after a checkpoint" do
    sources = Rebuild.sources()
    assert length(sources) >= 3

    report = Rebuild.report_all(nil, 1)
    assert report.scanned == length(sources)
    refute report.more

    {first_locator, _} = hd(sources)
    after_key = Rebuild.key(first_locator)
    assert Rebuild.report_all(after_key, 1).scanned == length(sources) - 1

    manifest =
      Path.join(System.tmp_dir!(), "mention-rebuild-pages-#{System.unique_integer()}.json")

    on_exit(fn -> File.rm(manifest) end)

    result = Rebuild.apply_all(nil, 1, false, manifest)
    assert result.processed == length(sources)
    refute Map.has_key?(result, :results)
    assert result.failures == []
    refute result.more
  end

  describe "sync/1" do
    test "soft-deleting a Comment clears its outgoing facts and advances the tombstone watermark",
         ~m(community post blog user)a do
      body =
        plate_body([
          block("mention", [text("#{@site_host}/#{community.slug}/blog/#{blog.inner_id}")])
        ])

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(body),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, {1, nil}} =
               CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => comment.id})

      assert Repo.exists?(
               from(m in ArtimentMention, where: m.mentioner_comment_id == ^comment.id)
             )

      command_id = Ecto.UUID.generate()

      assert {:ok, %{comment: _deleted}} =
               CMS.Comments.delete_comment_result(comment, user, command_id, community.slug)

      state = Repo.get_by!(SyncState, source_comment_id: comment.id)
      assert state.desired_content_token != state.synced_content_token

      event =
        Repo.get_by!(CMS.Outbox.Event,
          event: "comment.mention_sync",
          resource_id: to_string(comment.id),
          command_id: command_id
        )

      assert {:ok, :pass} =
               GroupherServer.Jobs.CMSOutboxComment.perform(%Oban.Job{
                 args: %{"event_id" => event.id},
                 attempt: 1,
                 max_attempts: 3
               })

      assert %SyncState{desired_content_token: token, synced_content_token: token} =
               Repo.get_by!(SyncState, source_comment_id: comment.id)

      refute Repo.exists?(
               from(m in ArtimentMention, where: m.mentioner_comment_id == ^comment.id)
             )

      source_key = Rebuild.key(%{type: :comment, comment_id: comment.id})
      refute Enum.any?(Rebuild.report(nil, 100).issues, &(&1.source_key == source_key))
    end

    test "Comment creation persists a token and reconciles facts in one committed sync",
         ~m(community post blog user)a do
      body =
        plate_body([
          block("mention", [text("#{@site_host}/#{community.slug}/blog/#{blog.inner_id}")])
        ])

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(body),
          user,
          Ecto.UUID.generate()
        )

      assert %SyncState{desired_content_token: token, synced_content_token: nil} =
               Repo.get_by!(SyncState, source_comment_id: comment.id)

      assert is_binary(token)

      assert {:ok, {1, nil}} =
               CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => comment.id})

      assert %SyncState{desired_content_token: ^token, synced_content_token: ^token} =
               Repo.get_by!(SyncState, source_comment_id: comment.id)

      {:ok, result} =
        ArtimentMentions.mentions(:comment, comment.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert [%{mentioned_article_id: target_id}] = result.entries
      assert target_id == blog.article_id

      assert {:ok, public_page} =
               ArtimentMentions.public_mentions(
                 community.slug,
                 %{
                   comment: %{
                     article: %{
                       community: community.slug,
                       thread: :post,
                       inner_id: article_inner_id(post, community)
                     },
                     inner_id: comment.inner_id
                   }
                 },
                 %GroupherServer.Pagi.Params.Offset{page: 1, size: 10}
               )

      assert [%{id: opaque_id, mentioned_url: url, occurrences_count: 1}] = public_page.entries
      assert String.starts_with?(opaque_id, "v1_")
      assert url == "/#{community.slug}/blog/#{article_inner_id(blog, community)}"
    end

    test "keeps a shared ordinary Comment after its origin binding becomes unavailable",
         ~m(community post user)a do
      {:ok, destination} = mock_community(user)
      article = Repo.get!(Article, post.article_id)
      assert {:ok, _binding} = CMS.Articles.BindingPersist.mirror(article, destination)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(
            plate_body([block("comment", [text("A comment that survives origin deletion")])])
          ),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, :done} = CMS.Articles.BindingPersist.unmirror(article, community)

      {1, nil} =
        Repo.update_all(
          from(comment_row in CMS.Model.Comment, where: comment_row.id == ^comment.id),
          set: [origin_community_id: nil]
        )

      retained = Repo.get!(CMS.Model.Comment, comment.id)
      assert retained.origin_community_id == nil
      assert {:error, _} = CMS.FrontDesk.article_of(retained)

      assert {:ok, resolved_community} = CMS.Comments.RequestCommunity.resolve(retained)
      assert resolved_community.id == destination.id

      assert {:ok, %{entries: profile_comments}} =
               CMS.Comments.paged_published_comments(
                 user,
                 nil,
                 %{},
                 %GroupherServer.Pagi.Params.Offset{page: 1, size: 20},
                 nil
               )

      assert Enum.any?(profile_comments, &(&1.id == comment.id))

      assert {:ok, requested_article} =
               CMS.FrontDesk.article(%{
                 community: destination.slug,
                 thread: :post,
                 inner_id: article_inner_id(post, destination)
               })

      assert requested_article.community.id == destination.id

      assert {:ok, visible} =
               CMS.FrontDesk.comment(%{
                 article: %{
                   community: destination.slug,
                   thread: :post,
                   inner_id: article_inner_id(post, destination)
                 },
                 inner_id: comment.inner_id
               })

      assert visible.id == comment.id
      assert visible.request_community_slug == destination.slug

      {:ok, reactor} = db_insert(:user)

      assert {:ok, _upvoted} =
               CMS.Interactions.upvote_result(visible, reactor, Ecto.UUID.generate())

      assert {:ok, _reacted} =
               CMS.Interactions.emotion_result(visible, :heart, reactor, Ecto.UUID.generate())

      assert {:ok, %{comment: reply}} =
               CMS.Comments.reply_comment_result(
                 retained,
                 mock_body_bag(plate_body([block("reply", [text("Reply after deletion")])])),
                 user,
                 Ecto.UUID.generate(),
                 destination.slug
               )

      assert reply.reply_to_comment_id == comment.id

      assert {:ok, %{comment: updated}} =
               CMS.Comments.update_comment_result(
                 retained,
                 mock_body_bag(
                   plate_body([block("update", [text("Edited after origin deletion")])])
                 ),
                 1,
                 user,
                 Ecto.UUID.generate(),
                 destination.slug
               )

      assert updated.id == comment.id

      assert {:ok, :pass} =
               CMS.Comments.Effects.deliver(:sync_mentions, %{"comment_id" => comment.id})

      assert %SyncState{desired_content_token: current_token, synced_content_token: current_token} =
               Repo.get_by!(SyncState, source_comment_id: comment.id)
    end

    test "builds a navigable Doc path when the public slug is empty" do
      assert PublicUrl.article(%{
               community_slug: "home",
               thread: :doc,
               inner_id: 42,
               slug: nil
             }) == "/home/doc/42/doc"
    end

    test "resolves a shared Comment parent through the requested mirror binding",
         ~m(community post user)a do
      {:ok, destination} = mock_community(user)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(plate_body([block("comment", [text("A shared comment body")])])),
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _binding} =
               CMS.Articles.BindingPersist.mirror(
                 Repo.get!(Article, post.article_id),
                 destination
               )

      assert {:ok, article} =
               CMS.FrontDesk.article(%{
                 community: destination.slug,
                 thread: :post,
                 inner_id: article_inner_id(post, destination)
               })

      assert article.article_id == post.article_id
      assert article.community.id == destination.id

      assert {:ok, shared_comment} =
               CMS.FrontDesk.comment(%{
                 article: %{
                   community: destination.slug,
                   thread: :post,
                   inner_id: article.inner_id
                 },
                 inner_id: comment.inner_id
               })

      assert shared_comment.id == comment.id

      assert {:ok, page} =
               CMS.Comments.page(:post, post.article_id, destination.slug, %{}, nil, :replies)

      assert Enum.any?(page.entries, &(&1.id == comment.id))

      assert {:ok, %{comment: reply}} =
               CMS.Comments.reply_comment_result(
                 comment,
                 mock_body_bag(plate_body([block("reply", [text("A reply from destination")])])),
                 user,
                 Ecto.UUID.generate(),
                 destination.slug
               )

      assert reply.reply_to_comment_id == comment.id
      assert reply.origin_community_id == destination.id

      assert {:ok, reply_article} =
               CMS.FrontDesk.article(%{
                 community: destination.slug,
                 thread: :post,
                 inner_id: article_inner_id(post, destination)
               })

      assert reply_article.community.id == destination.id

      assert {:ok, %{comment: updated}} =
               CMS.Comments.update_comment_result(
                 comment,
                 mock_body_bag(plate_body([block("update", [text("Updated from destination")])])),
                 1,
                 user,
                 Ecto.UUID.generate(),
                 destination.slug
               )

      assert updated.id == comment.id

      assert {:ok, %{comment: deleted}} =
               CMS.Comments.delete_comment_result(
                 updated,
                 user,
                 Ecto.UUID.generate(),
                 destination.slug
               )

      assert deleted.id == comment.id
    end

    test "publishing records one durable Article-level Mention intent and syncs its token",
         ~m(community blog user)a do
      body =
        plate_body([
          block("mention", [text("#{@site_host}/#{community.slug}/blog/#{blog.inner_id}")])
        ])

      {:ok, %{article: article, draft: draft}} =
        CMS.Articles.create_stable_draft(
          community,
          :post,
          %{
            title: "Mention source",
            digest: "A publishable mention source",
            body_bag: mock_body_bag(body)
          },
          user
        )

      command_id = Ecto.UUID.generate()

      assert {:ok, %{public: public}} =
               CMS.Articles.publish(article.id, user,
                 community: community,
                 expected_draft_version: draft.version,
                 expected_lifecycle_version: 1,
                 command_id: command_id
               )

      token = "#{public.revision_id}:#{public.publication_version}"

      assert %SyncState{desired_content_token: ^token, synced_content_token: nil} =
               Repo.get_by!(SyncState, source_article_id: article.id)

      events = Repo.all(CMS.Outbox.Event) |> Enum.filter(&(&1.command_id == command_id))
      assert Enum.count(events, &(&1.event == "article.mention_sync")) == 1

      event =
        events
        |> Enum.find(&(&1.event == "article.mention_sync"))
        |> Ecto.Changeset.change(
          data: %{"source_type" => "post", "content_token" => "late-event-token"}
        )
        |> Repo.update!()

      assert {:ok, :pass} =
               GroupherServer.Jobs.CMSOutboxArticle.perform(%Oban.Job{
                 args: %{"event_id" => event.id},
                 attempt: 1,
                 max_attempts: 3
               })

      assert %SyncState{desired_content_token: ^token, synced_content_token: ^token} =
               Repo.get_by!(SyncState, source_article_id: article.id)

      assert {:ok, :pass} =
               ArtimentMentions.sync_current(%{type: :post, article_id: article.id})

      source_key = Rebuild.key(%{type: :post, article_id: article.id})

      assert Enum.any?(Rebuild.sources(), fn {locator, _} ->
               Rebuild.key(locator) == source_key
             end)

      assert [] == Enum.filter(Rebuild.report(nil, 100).issues, &(&1.source_key == source_key))

      Repo.delete_all(from(state in SyncState, where: state.source_article_id == ^article.id))

      assert Enum.any?(
               Rebuild.report(nil, 100).issues,
               &(&1.source_key == source_key and &1.category == :missing_watermark)
             )

      manifest =
        Path.join(System.tmp_dir!(), "mention-rebuild-#{System.unique_integer([:positive])}.json")

      on_exit(fn -> File.rm(manifest) end)
      result = Rebuild.apply(nil, 100, false, manifest)
      assert result.failures == []

      assert %SyncState{synced_content_token: ^token} =
               Repo.get_by!(SyncState, source_article_id: article.id)

      Repo.get_by!(SyncState, source_article_id: article.id)
      |> SyncState.changeset(%{desired_content_token: "stale-desired-token"})
      |> Repo.update!()

      assert Enum.any?(Rebuild.report(nil, 100).issues, fn issue ->
               issue.source_key == source_key and issue.category == :canonical_drift
             end)

      assert Rebuild.apply(nil, 100, false, manifest).failures == []

      assert %SyncState{desired_content_token: ^token, synced_content_token: ^token} =
               Repo.get_by!(SyncState, source_article_id: article.id)

      {:ok, result} =
        ArtimentMentions.mentions(:post, article.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert [%{mentioned_article_id: target_id}] = result.entries
      assert target_id == blog.article_id

      event
      |> Ecto.Changeset.change(status: :failed)
      |> Repo.update!()

      assert Enum.any?(Rebuild.report(nil, 100).issues, fn issue ->
               issue.source_key == source_key and issue.category == :exhausted_outbox
             end)

      File.write!(manifest, "not JSON")

      assert_raise RuntimeError, ~r/invalid Mention rebuild failure manifest JSON/, fn ->
        Rebuild.read_manifest(manifest)
      end

      {:ok, destination} = mock_community(user)
      assert {:ok, 0} = GraphRevision.current(destination.id)

      assert {:ok, _binding} =
               CMS.Articles.BindingPersist.mirror(Repo.get!(Article, article.id), destination)

      assert {:ok, 1} = GraphRevision.current(destination.id)

      assert Repo.aggregate(
               from(state in SyncState, where: state.source_article_id == ^article.id),
               :count,
               :id
             ) == 1

      {:ok, mirrored_result} =
        ArtimentMentions.mentions(:post, article.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert mirrored_result.total_count == 1
    end

    test "advances the source Community graph even when no mentions are found",
         ~m(community post_attrs user)a do
      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{
            body_bag:
              mock_body_bag(plate_body([block("plain", [text("plain body without mentions")])]))
          }),
          user
        )

      assert {:ok, before_revision} = GraphRevision.current(community.id)
      assert {:ok, :pass} = ArtimentMentions.sync(post)
      assert {:ok, after_revision} = GraphRevision.current(community.id)
      assert after_revision == before_revision + 1
    end

    test "recognizes a public community article URL as an internal mention",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [
            text("#{@site_host}/#{community.slug}/blog/#{blog.inner_id}")
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      assert {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert [%{mentioned_scope: :internal, mentioned_article_id: article_id}] = result.entries
      assert article_id == blog.article_id
    end

    test "sync/1 ignores a stale loaded body and keeps the canonical public target",
         ~m(community post_attrs blog changelog user)a do
      current_body =
        plate_body([
          block("current", [text("#{@site_host}/#{community.slug}/blog/#{blog.inner_id}")])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(current_body)}),
          user
        )

      assert {:ok, {1, nil}} = ArtimentMentions.sync(post)

      stale_body =
        plate_body([
          block("stale", [text("#{@site_host}/#{community.slug}/changelog/#{changelog.inner_id}")])
        ])

      assert {:ok, :pass} = ArtimentMentions.sync(Map.put(post, :body, stale_body))

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert [%{mentioned_article_id: target_id}] = result.entries
      assert target_id == blog.article_id
    end

    test "resolves the URL Community independently of the source binding",
         ~m(post_attrs user)a do
      {:ok, source_community} = mock_community(user)
      {:ok, target_community} = mock_community(user)
      {_, target, _, _} = mock_article(:blog, target_community, user)

      body =
        plate_body([
          block("block-a", [
            text("#{@site_host}/#{target_community.slug}/blog/#{target.inner_id}")
          ])
        ])

      {:ok, source} =
        CMS.Articles.create(
          source_community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      assert {:ok, {1, nil}} = ArtimentMentions.sync(source)

      {:ok, result} =
        ArtimentMentions.mentions(:post, source.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert [%{mentioned_article_id: article_id}] = result.entries
      assert article_id == target.article_id
    end

    test "keeps custom domain and forged platform host links external",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [
            text("https://example.com/#{community.slug}/blog/#{blog.inner_id}"),
            text("https://groupher.com.evil/#{community.slug}/blog/#{blog.inner_id}")
          ])
        ])

      {:ok, source} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      assert {:ok, {2, nil}} = ArtimentMentions.sync(source)

      {:ok, result} =
        ArtimentMentions.mentions(:post, source.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert Enum.all?(result.entries, &(&1.mentioned_scope == :external))
    end

    test "resolves public Comment fragments by comment inner ID",
         ~m(community post post_attrs user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(plate_body([block("comment", [text("A public comment body")])])),
          user,
          Ecto.UUID.generate()
        )

      url =
        "#{@site_host}/#{community.slug}/post/#{article_inner_id(post, community)}" <>
          "#comment-#{comment.inner_id}"

      {:ok, source} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{
            body_bag: mock_body_bag(plate_body([block("source", [text(url)])]))
          }),
          user
        )

      assert {:ok, {1, nil}} = ArtimentMentions.sync(source)

      {:ok, result} =
        ArtimentMentions.mentions(:post, source.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      expected_path =
        "/#{community.slug}/post/#{article_inner_id(post, community)}#comment-#{comment.inner_id}"

      assert [%{mentioned_type: :comment, mentioned_comment_id: comment_id}] = result.entries
      assert comment_id == comment.id

      assert PublicUrl.comment(
               %{
                 community_slug: community.slug,
                 thread: :post,
                 inner_id: article_inner_id(post, community)
               },
               comment.inner_id
             ) == expected_path
    end

    test "keeps distinct article targets when merging occurrences",
         ~m(community post_attrs blog user)a do
      {_, other_blog, _, _} = mock_article(:blog, community, user)

      body =
        plate_body([
          block("block-a", [
            text("#{@site_host}/blog/#{blog.id}"),
            text("#{@site_host}/blog/#{other_blog.id}"),
            text("#{@site_host}/blog/#{blog.id}")
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      assert {:ok, {2, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert MapSet.new(Enum.map(result.entries, & &1.mentioned_article_id)) ==
               MapSet.new([blog.article_id, other_blog.article_id])

      assert length(
               Enum.find(result.entries, &(&1.mentioned_article_id == blog.article_id)).occurrences
             ) == 2
    end

    test "normalizes internal links to inline mentions and keeps external links as links",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [
            text("see "),
            text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>)),
            text(" and https://example.com/doc")
          ]),
          block("block-b", [
            text(~s(repeat <a href="#{@site_host}/blog/#{blog.id}">blog again</a>))
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {2, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      entries = result.entries

      assert result.total_count == 2

      internal = Enum.find(entries, &(&1.mentioned_type == :blog))
      assert internal.mentioned_scope == :internal
      assert internal.mention_case == :inline_mention
      assert internal.mentioned_article_id == blog.article_id
      assert length(internal.occurrences) == 2
      assert Enum.all?(internal.occurrences, &(&1["normalized_from"] == "link"))

      external = Enum.find(entries, &(&1.mentioned_type == :url))
      assert external.mentioned_scope == :external
      assert external.mention_case == :link
      assert external.external_url == "https://example.com/doc"
      assert external.external_url_hash
    end

    test "stores inline user mentions as internal mentions",
         ~m(community post_attrs mentioned_user user)a do
      body =
        plate_body([
          block("block-a", [
            mention(%{
              "value" => mentioned_user.login,
              "children" => [%{"text" => mentioned_user.login}]
            })
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention = result.entries |> List.first()

      assert mention.mentioned_scope == :internal
      assert mention.mentioned_type == :user
      assert mention.mentioned_user_id == mentioned_user.id
      assert mention.mention_case == :inline_mention
      assert mention.occurrences |> List.first() |> Map.get("display") == mentioned_user.login
    end

    test "syncs current editor ast user mentions and links",
         ~m(community post_attrs mentioned_user user)a do
      body =
        plate_body([
          %{
            "type" => "h1",
            "id" => "title-1",
            "_id" => "title-1",
            "children" => [%{"text" => "Plate Editor"}]
          },
          %{
            "type" => "p",
            "id" => "mention-block",
            "_id" => "mention-block",
            "children" => [
              %{"text" => "hello "},
              mention(%{
                "value" => mentioned_user.login,
                "id" => "mention-1",
                "children" => [%{"text" => ""}]
              }),
              %{"text" => " see https://example.com/doc"}
            ]
          },
          %{
            "children" => [%{"text" => "todo item"}],
            "type" => "p",
            "id" => "todo-1",
            "_id" => "todo-1",
            "indent" => 1,
            "checked" => false,
            "listStyleType" => "todo"
          },
          %{
            "type" => "toggle",
            "id" => "toggle-1",
            "_id" => "toggle-1",
            "children" => [%{"text" => "Toggle blocks can hide content."}]
          }
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {2, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      user_mention = Enum.find(result.entries, &(&1.mentioned_type == :user))
      assert user_mention.mentioned_user_id == mentioned_user.id
      assert user_mention.mention_case == :inline_mention
      assert user_mention.occurrences |> List.first() |> Map.get("block_id") == "mention-block"
      assert user_mention.occurrences |> List.first() |> Map.get("path") == [1, 1]

      external = Enum.find(result.entries, &(&1.mentioned_type == :url))
      assert external.external_url == "https://example.com/doc"
      assert external.mention_case == :link
    end

    test "supports cross article mentions among post, blog, and changelog",
         ~m(post blog changelog user)a do
      blog_body =
        plate_body([
          block("block-blog", [text(~s(<a href="#{@site_host}/post/#{post.id}">post</a>))])
        ])

      changelog_body =
        plate_body([
          block("block-changelog", [
            text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))
          ])
        ])

      {:ok, blog} =
        CMS.Articles.update(
          blog,
          %{body_bag: mock_body_bag(blog_body), expected_version: blog.version},
          user,
          Ecto.UUID.generate()
        )

      {:ok, changelog} =
        CMS.Articles.update(
          changelog,
          %{body_bag: mock_body_bag(changelog_body), expected_version: changelog.version},
          user,
          Ecto.UUID.generate()
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(blog)
      {:ok, {1, nil}} = ArtimentMentions.sync(changelog)

      {:ok, post_mentions} =
        ArtimentMentions.mentioned_by(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      {:ok, blog_mentions} =
        ArtimentMentions.mentioned_by(:blog, blog.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert post_mentions.total_count == 1
      post_mention = post_mentions.entries |> List.first()
      assert post_mention.mentioner_type == :blog

      assert blog_mentions.total_count == 1
      blog_mention = blog_mentions.entries |> List.first()
      assert blog_mention.mentioner_type == :changelog
    end

    test "ignores self mentions for artiments and authors", ~m(community post_attrs user)a do
      body =
        plate_body([
          block("block-a", [
            text(~s(<a href="#{@site_host}/post/self">self placeholder</a>)),
            mention(%{
              "value" => user.login,
              "children" => [%{"text" => user.login}]
            })
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.put(post_attrs, :body_bag, mock_body_bag(post_attrs.body)),
          user
        )

      self_body =
        body
        |> Jason.decode!()
        |> put_in(
          [Access.at(0), "children", Access.at(0), "text"],
          ~s(<a href="#{@site_host}/#{community.slug}/post/#{article_inner_id(post, community)}">self</a>)
        )
        |> Jason.encode!()

      {:ok, post} =
        CMS.Articles.update(
          post,
          %{body_bag: mock_body_bag(self_body), expected_version: post.version},
          user,
          Ecto.UUID.generate()
        )

      {:ok, :pass} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 0
    end

    test "rebuilds mentions when a comment is updated",
         ~m(community post blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          mock_body_bag(
            plate_body([
              block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
            ])
          ),
          user,
          Ecto.UUID.generate()
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(comment)

      {:ok, result} =
        ArtimentMentions.mentions(:comment, comment.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1

      {:ok, %{comment: comment}} =
        CMS.Comments.update_comment(
          comment,
          mock_body_bag(plate_body([block("block-b", [text("https://example.com/changed")])])),
          1,
          user,
          Ecto.UUID.generate()
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(comment)

      {:ok, result} =
        ArtimentMentions.mentions(:comment, comment.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention = result.entries |> List.first()

      assert result.total_count == 1
      assert mention.mentioned_type == :url
      assert mention.external_url == "https://example.com/changed"
    end

    test "keeps Comment parent lookups constant as Comment mentions grow",
         ~m(community post blog user)a do
      target_comments =
        Enum.map(1..3, fn index ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              :blog,
              article_inner_id(blog, community),
              mock_body_bag(
                plate_body([block("target-#{index}", [text("target comment #{index}")])])
              ),
              user,
              Ecto.UUID.generate()
            )

          comment
        end)

      comment_body = fn comments ->
        links =
          Enum.map_join(comments, " ", fn comment ->
            ~s(<a href="#{@site_host}/blog/#{blog.id}?comment_id=#{comment.id}">target</a>)
          end)

        mock_body_bag(plate_body([block("comment-links", [text(links)])]))
      end

      {:ok, mentioner} =
        CMS.Comments.create_comment(
          community,
          :post,
          article_inner_id(post, community),
          comment_body.([List.first(target_comments)]),
          user,
          Ecto.UUID.generate()
        )

      # Warm the replace path so both measurements delete and insert existing facts.
      assert {:ok, {1, nil}} = ArtimentMentions.sync(mentioner)

      {single_result, single_queries} =
        capture_repo_queries(fn ->
          ArtimentMentions.sync_current(%{type: :comment, comment_id: mentioner.id}, force: true)
        end)

      {:ok, %{comment: mentioner}} =
        CMS.Comments.update_comment(
          mentioner,
          comment_body.(target_comments),
          1,
          user,
          Ecto.UUID.generate()
        )

      {many_result, many_queries} =
        capture_repo_queries(fn ->
          ArtimentMentions.sync_current(%{type: :comment, comment_id: mentioner.id}, force: true)
        end)

      assert {:ok, {1, nil}} = single_result
      assert {:ok, {3, nil}} = many_result
      assert data_query_count(many_queries) <= data_query_count(single_queries) + 1

      assert {:ok, %{total_count: 3}} =
               ArtimentMentions.mentions(
                 :comment,
                 mentioner.id,
                 %GroupherServer.Pagi.Params.Offset{
                   page: 1,
                   size: 10
                 }
               )
    end

    test "deletes old mentions when the current content has none",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, post} =
        CMS.Articles.update(
          post,
          %{
            expected_version: post.version,
            body_bag:
              mock_body_bag(
                plate_body([block("block-b", [text("clean content without mentions")])])
              )
          },
          user,
          Ecto.UUID.generate()
        )

      {:ok, :pass} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentions(:post, post.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 0
    end

    test "keeps stable incoming facts when a source is review blocked",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentioned_by(:blog, blog.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      mention = result.entries |> List.first()

      assert result.total_count == 1
      assert mention.mentioner_type == :post
      assert mention.mentioner_article_id == post.article_id

      article = Repo.get!(Article, post.article_id)

      Repo.transaction(fn ->
        {:ok, locked_lifecycle} = CMS.Articles.Lifecycle.lock(article)

        assert {:ok, _restriction} =
                 CMS.ReviewBlocks.apply(locked_lifecycle, %{
                   scope_key: "community:#{community.id}",
                   type: :manual_hold,
                   source_ref: "mention-source-test",
                   source: :human,
                   applied_at: DateTime.utc_now(:second)
                 })
      end)

      {:ok, result} =
        ArtimentMentions.mentioned_by(:blog, blog.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1
    end

    test "purges mentions when an article is hard deleted", ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
        ])

      {:ok, post} =
        CMS.Articles.create(
          community,
          :post,
          Map.merge(post_attrs, %{body_bag: mock_body_bag(body)}),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, result} =
        ArtimentMentions.mentioned_by(:blog, blog.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 1

      {:ok, trash_item} = CMS.Articles.trash(post, user)

      {:ok, %{done: true}} =
        CMS.Articles.permanently_delete_trashed(trash_item.hash_id, user)

      {:ok, result} =
        ArtimentMentions.mentioned_by(:blog, blog.id, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 10
        })

      assert result.total_count == 0
    end

    test "changeset rejects missing external URL hash", ~m(post)a do
      attrs = %{
        mentioner_type: :post,
        mentioner_article_id: post.article_id,
        mentioned_scope: :external,
        mentioned_type: :url,
        external_url: "https://example.com",
        mention_case: :link,
        occurrences: [%{path: [0, 0]}],
        mentioned_at: DateTime.utc_now(:second)
      }

      changeset = ArtimentMention.changeset(%ArtimentMention{}, attrs)
      refute changeset.valid?
      assert %{external_url_hash: ["can't be blank"]} = errors_on(changeset)
    end

    test "database owns edge key and rejects a duplicate logical edge", ~m(post blog)a do
      now = DateTime.utc_now(:second)

      row = %{
        mentioner_type: :post,
        mentioner_article_id: post.article_id,
        mentioned_scope: :internal,
        mentioned_type: :blog,
        mentioned_article_id: blog.article_id,
        mention_case: :inline_mention,
        occurrences: [%{path: [0, 0]}],
        edge_key: "forged",
        mentioned_at: now,
        inserted_at: now,
        updated_at: now
      }

      assert {1, nil} = Repo.insert_all(ArtimentMention, [row])
      mention = Repo.get_by!(ArtimentMention, mentioner_article_id: post.article_id)
      refute mention.edge_key == "forged"

      assert_raise Postgrex.Error, fn ->
        Repo.transaction(fn ->
          Repo.insert_all(ArtimentMention, [%{row | edge_key: "another"}])
        end)
      end
    end

    test "database rejects a wrong Article target type and an empty occurrence list",
         ~m(post blog)a do
      now = DateTime.utc_now(:second)

      row = %{
        mentioner_type: :post,
        mentioner_article_id: post.article_id,
        mentioned_scope: :internal,
        mentioned_type: :post,
        mentioned_article_id: blog.article_id,
        mention_case: :inline_mention,
        occurrences: [%{path: [0, 0]}],
        mentioned_at: now,
        inserted_at: now,
        updated_at: now
      }

      assert_raise Postgrex.Error, fn ->
        Repo.transaction(fn -> Repo.insert_all(ArtimentMention, [row]) end)
      end

      assert_raise Postgrex.Error, fn ->
        Repo.transaction(fn ->
          Repo.insert_all(ArtimentMention, [
            %{row | mentioned_type: :blog, occurrences: []}
          ])
        end)
      end
    end
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp data_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.match?(~r/^(SELECT|INSERT|UPDATE|DELETE)/)
    end)
  end

  defp plate_body(blocks), do: Jason.encode!(blocks)

  defp block(id, children) do
    %{
      "type" => "p",
      "id" => id,
      "_id" => id,
      "children" => children
    }
  end

  defp text(value), do: %{"text" => value}
  defp mention(attrs), do: Map.merge(%{"type" => "mention"}, attrs)
end
