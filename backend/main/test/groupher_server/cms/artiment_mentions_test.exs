defmodule GroupherServer.Test.CMS.ArtimentMentionsTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias CMS.ArtimentMentions
  alias CMS.Model.ArtimentMention

  @site_host GroupherServer.CMS.ArtimentMentions.Config.site_host()

  setup do
    {community, post, post_attrs, user} = mock_article(:post, preload: [author: :user])
    {_, blog, _, _} = mock_article(:blog, community, user)
    {_, changelog, _, _} = mock_article(:changelog, community, user)
    {:ok, mentioned_user} = db_insert(:user)

    {:ok, ~m(community post post_attrs blog changelog user mentioned_user)a}
  end

  describe "sync/1" do
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

      {:ok, result} = ArtimentMentions.mentions(:post, post.id, %{page: 1, size: 10})
      entries = result.entries

      assert result.total_count == 2

      internal = Enum.find(entries, &(&1.mentioned_type == :blog))
      assert internal.mentioner_community_id == community.id
      assert internal.mentioned_community_id == community.id
      assert internal.mentioned_scope == :internal
      assert internal.mention_case == :inline_mention
      assert internal.mentioned_id == blog.id
      assert length(internal.occurrences) == 2
      assert Enum.all?(internal.occurrences, &(&1["normalized_from"] == "link"))

      external = Enum.find(entries, &(&1.mentioned_type == :url))
      assert external.mentioner_community_id == community.id
      assert external.mentioned_community_id == nil
      assert external.mentioned_scope == :external
      assert external.mention_case == :link
      assert external.mentioned_url == "https://example.com/doc"
      assert external.mentioned_url_hash
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

      {:ok, result} = ArtimentMentions.mentions(:post, post.id, %{page: 1, size: 10})
      mention = result.entries |> List.first()

      assert mention.mentioned_scope == :internal
      assert mention.mentioned_type == :user
      assert mention.mentioned_id == mentioned_user.id
      assert mention.mentioner_community_id == community.id
      assert mention.mentioned_community_id == nil
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

      {:ok, result} = ArtimentMentions.mentions(:post, post.id, %{page: 1, size: 10})

      user_mention = Enum.find(result.entries, &(&1.mentioned_type == :user))
      assert user_mention.mentioned_id == mentioned_user.id
      assert user_mention.mention_case == :inline_mention
      assert user_mention.occurrences |> List.first() |> Map.get("block_id") == "mention-block"
      assert user_mention.occurrences |> List.first() |> Map.get("path") == [1, 1]

      external = Enum.find(result.entries, &(&1.mentioned_type == :url))
      assert external.mentioned_url == "https://example.com/doc"
      assert external.mention_case == :link
    end

    test "supports cross article mentions among post, blog, and changelog",
         ~m(community post blog changelog user)a do
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

      {:ok, blog_draft} = CMS.Articles.update(blog, %{body_bag: mock_body_bag(blog_body)})

      {:ok, changelog_draft} =
        CMS.Articles.update(changelog, %{body_bag: mock_body_bag(changelog_body)})

      {:ok, %{article: blog}} =
        CMS.Articles.publish_draft(community, :blog, blog_draft.article_hash_id, user)

      {:ok, %{article: changelog}} =
        CMS.Articles.publish_draft(community, :changelog, changelog_draft.article_hash_id, user)

      {:ok, {1, nil}} = ArtimentMentions.sync(blog)
      {:ok, {1, nil}} = ArtimentMentions.sync(changelog)

      {:ok, post_mentions} = ArtimentMentions.mentioned_by(:post, post.id, %{page: 1, size: 10})
      {:ok, blog_mentions} = ArtimentMentions.mentioned_by(:blog, blog.id, %{page: 1, size: 10})

      assert post_mentions.total_count == 1
      post_mention = post_mentions.entries |> List.first()
      assert post_mention.mentioner_type == :blog
      assert post_mention.mentioner_community_id == post.community_id
      assert post_mention.mentioned_community_id == post.community_id

      assert blog_mentions.total_count == 1
      blog_mention = blog_mentions.entries |> List.first()
      assert blog_mention.mentioner_type == :changelog
      assert blog_mention.mentioner_community_id == blog.community_id
      assert blog_mention.mentioned_community_id == blog.community_id
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
          ~s(<a href="#{@site_host}/post/#{post.id}">self</a>)
        )
        |> Jason.encode!()

      {:ok, draft} = CMS.Articles.update(post, %{body_bag: mock_body_bag(self_body)})

      {:ok, %{article: post}} =
        CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

      {:ok, :pass} = ArtimentMentions.sync(post)

      {:ok, result} = ArtimentMentions.mentions(:post, post.id, %{page: 1, size: 10})

      assert result.total_count == 0
    end

    test "rebuilds mentions when a comment is updated",
         ~m(community post blog user)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          post.inner_id,
          plate_body([
            block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
          ]),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(comment)

      {:ok, result} = ArtimentMentions.mentions(:comment, comment.id, %{page: 1, size: 10})
      assert result.total_count == 1
      mention = result.entries |> List.first()
      assert mention.mentioner_community_id == community.id
      assert mention.mentioned_community_id == community.id

      {:ok, comment} =
        CMS.Comments.update_comment(
          comment,
          plate_body([block("block-b", [text("https://example.com/changed")])]),
          user
        )

      {:ok, {1, nil}} = ArtimentMentions.sync(comment)

      {:ok, result} = ArtimentMentions.mentions(:comment, comment.id, %{page: 1, size: 10})
      mention = result.entries |> List.first()

      assert result.total_count == 1
      assert mention.mentioner_community_id == community.id
      assert mention.mentioned_community_id == nil
      assert mention.mentioned_type == :url
      assert mention.mentioned_url == "https://example.com/changed"
    end

    test "keeps Comment parent lookups constant as Comment mentions grow",
         ~m(community post blog user)a do
      target_comments =
        Enum.map(1..3, fn index ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              :blog,
              blog.inner_id,
              plate_body([block("target-#{index}", [text("target #{index}")])]),
              user
            )

          comment
        end)

      comment_body = fn comments ->
        links =
          Enum.map_join(comments, " ", fn comment ->
            ~s(<a href="#{@site_host}/blog/#{blog.id}?comment_id=#{comment.id}">target</a>)
          end)

        plate_body([block("comment-links", [text(links)])])
      end

      {:ok, mentioner} =
        CMS.Comments.create_comment(
          community,
          :post,
          post.inner_id,
          comment_body.([List.first(target_comments)]),
          user
        )

      # Warm the replace path so both measurements delete and insert existing facts.
      assert {:ok, {1, nil}} = ArtimentMentions.sync(mentioner)

      {single_result, single_queries} =
        capture_repo_queries(fn -> ArtimentMentions.sync(mentioner) end)

      {:ok, mentioner} =
        CMS.Comments.update_comment(mentioner, comment_body.(target_comments), user)

      {many_result, many_queries} =
        capture_repo_queries(fn -> ArtimentMentions.sync(mentioner) end)

      assert {:ok, {1, nil}} = single_result
      assert {:ok, {3, nil}} = many_result
      assert data_query_count(single_queries) == data_query_count(many_queries)

      assert {:ok, %{total_count: 3}} =
               ArtimentMentions.mentions(:comment, mentioner.id, %{page: 1, size: 10})
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

      {:ok, draft} =
        CMS.Articles.update(post, %{
          body_bag:
            mock_body_bag(
              plate_body([block("block-b", [text("clean content without mentions")])])
            )
        })

      {:ok, %{article: post}} =
        CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

      {:ok, :pass} = ArtimentMentions.sync(post)

      {:ok, result} = ArtimentMentions.mentions(:post, post.id, %{page: 1, size: 10})
      assert result.total_count == 0
    end

    test "supports mentioned_by for internal content", ~m(community post_attrs blog user)a do
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

      {:ok, result} = ArtimentMentions.mentioned_by(:blog, blog.id, %{page: 1, size: 10})
      mention = result.entries |> List.first()

      assert result.total_count == 1
      assert mention.mentioner_type == :post
      assert mention.mentioner_id == post.id
      assert mention.mentioner_community_id == community.id
      assert mention.mentioned_community_id == community.id
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
      {:ok, result} = ArtimentMentions.mentioned_by(:blog, blog.id, %{page: 1, size: 10})
      assert result.total_count == 1

      {:ok, trash_item} = CMS.Articles.trash(post, user)
      {:ok, %{done: true}} = CMS.Articles.permanently_delete_trashed(trash_item, user)

      {:ok, result} = ArtimentMentions.mentioned_by(:blog, blog.id, %{page: 1, size: 10})
      assert result.total_count == 0
    end

    test "rejects invalid external mentions without url hash", ~m(community)a do
      attrs = %{
        mentioner_type: :post,
        mentioner_id: 1,
        mentioner_community_id: community.id,
        mentioned_scope: :external,
        mentioned_type: :url,
        mentioned_url: "https://example.com",
        mention_case: :link,
        mentioned_at: DateTime.utc_now() |> DateTime.truncate(:second)
      }

      changeset = ArtimentMention.changeset(%ArtimentMention{}, attrs)

      refute changeset.valid?
      assert %{mentioned_url_hash: ["can't be blank"]} = errors_on(changeset)
    end

    test "rejects inconsistent mention scope fields", ~m(community)a do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      internal_attrs = %{
        mentioner_type: :post,
        mentioner_id: 1,
        mentioner_community_id: community.id,
        mentioned_scope: :internal,
        mentioned_type: :blog,
        mentioned_id: 2,
        mentioned_url_hash: "hash",
        mention_case: :link,
        mentioned_at: now
      }

      external_attrs = %{
        mentioner_type: :post,
        mentioner_id: 1,
        mentioner_community_id: community.id,
        mentioned_scope: :external,
        mentioned_type: :url,
        mentioned_id: 2,
        mentioned_community_id: community.id,
        mentioned_url: "https://example.com",
        mentioned_url_hash: "hash",
        mention_case: :inline_mention,
        mentioned_at: now
      }

      internal_changeset = ArtimentMention.changeset(%ArtimentMention{}, internal_attrs)
      external_changeset = ArtimentMention.changeset(%ArtimentMention{}, external_attrs)

      refute internal_changeset.valid?

      assert %{mention_case: ["must be inline_mention"], mentioned_url_hash: ["must be blank"]} =
               errors_on(internal_changeset)

      refute external_changeset.valid?

      assert %{
               mention_case: ["must be link"],
               mentioned_id: ["must be blank"],
               mentioned_community_id: ["must be blank"]
             } = errors_on(external_changeset)
    end
  end

  describe "mark_target_state/2" do
    test "updates every lifecycle state with one statement and preserves unrelated JSON",
         ~m(community post)a do
      old_updated_at = Datetime.shift(DateTime.utc_now(:second), days: -1)
      insert_incoming_mentions(community, post, 3, old_updated_at)

      {trashed_result, trashed_queries} =
        capture_repo_queries(fn -> ArtimentMentions.mark_target_state(post, :trashed) end)

      assert {:ok, :pass} = trashed_result
      assert mention_update_query_count(trashed_queries) == 1

      trashed_mentions = incoming_mentions(post)
      assert length(trashed_mentions) == 3

      Enum.each(trashed_mentions, fn mention ->
        assert mention.mentioned_snapshot["keep"] == "snapshot"
        assert mention.mentioned_snapshot["deletionState"] == "trashed"
        assert is_binary(mention.mentioned_snapshot["deletedAt"])
        assert mention.meta["keep"] == "meta"
        assert mention.meta["mentionedDeleted"]
        assert mention.meta["mentionedTrashed"]
        assert is_binary(mention.meta["mentionedDeletedAt"])
        assert DateTime.compare(mention.updated_at, old_updated_at) == :gt
      end)

      {deleted_result, deleted_queries} =
        capture_repo_queries(fn ->
          ArtimentMentions.mark_target_state(post, :permanently_deleted)
        end)

      assert {:ok, :pass} = deleted_result
      assert mention_update_query_count(deleted_queries) == 1

      Enum.each(incoming_mentions(post), fn mention ->
        assert mention.mentioned_snapshot["deletionState"] == "permanently_deleted"
        assert mention.meta["mentionedDeleted"]
        refute mention.meta["mentionedTrashed"]
      end)

      {active_result, active_queries} =
        capture_repo_queries(fn -> ArtimentMentions.mark_target_state(post, :active) end)

      assert {:ok, :pass} = active_result
      assert mention_update_query_count(active_queries) == 1

      Enum.each(incoming_mentions(post), fn mention ->
        assert mention.mentioned_snapshot["keep"] == "snapshot"
        refute Map.has_key?(mention.mentioned_snapshot, "deletionState")
        refute Map.has_key?(mention.mentioned_snapshot, "deletedAt")
        assert mention.meta["keep"] == "meta"
        refute Map.has_key?(mention.meta, "mentionedDeleted")
        refute Map.has_key?(mention.meta, "mentionedTrashed")
        refute Map.has_key?(mention.meta, "mentionedDeletedAt")
      end)
    end

    test "participates in the caller transaction", ~m(community post)a do
      old_updated_at = Datetime.shift(DateTime.utc_now(:second), days: -1)
      insert_incoming_mentions(community, post, 2, old_updated_at)

      rollback_error = GroupherServer.ErrorCat.custom("forced rollback")

      assert {:error, ^rollback_error} =
               Repo.transaction(fn ->
                 assert {:ok, :pass} =
                          ArtimentMentions.mark_target_state(post, :permanently_deleted)

                 Repo.rollback(rollback_error)
               end)

      Enum.each(incoming_mentions(post), fn mention ->
        refute Map.has_key?(mention.mentioned_snapshot, "deletionState")
        refute Map.has_key?(mention.meta, "mentionedDeleted")
        assert mention.updated_at == old_updated_at
      end)
    end
  end

  defp insert_incoming_mentions(community, post, count, timestamp) do
    rows =
      Enum.map(1..count, fn index ->
        %{
          mentioner_type: :blog,
          mentioner_id: 10_000 + index,
          mentioner_community_id: community.id,
          mentioner_url: "#{@site_host}/blog/#{10_000 + index}",
          mentioned_scope: :internal,
          mentioned_type: :post,
          mentioned_id: post.id,
          mentioned_community_id: community.id,
          mentioned_url: "#{@site_host}/post/#{post.id}",
          mention_case: :inline_mention,
          occurrences: [],
          mentioner_snapshot: %{},
          mentioned_snapshot: %{"keep" => "snapshot"},
          meta: %{"keep" => "meta"},
          mentioned_at: timestamp,
          inserted_at: timestamp,
          updated_at: timestamp
        }
      end)

    assert {^count, nil} = Repo.insert_all(ArtimentMention, rows)
  end

  defp incoming_mentions(post) do
    ArtimentMention
    |> where(
      [mention],
      mention.mentioned_scope == :internal and mention.mentioned_type == :post and
        mention.mentioned_id == ^post.id
    )
    |> order_by([mention], asc: mention.id)
    |> Repo.all()
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

  defp mention_update_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.starts_with?(~s(UPDATE "cms"."artiment_mentions"))
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
