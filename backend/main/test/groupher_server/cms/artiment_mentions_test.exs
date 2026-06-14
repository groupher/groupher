defmodule GroupherServer.Test.CMS.ArtimentMentionsTest do
  @moduledoc false

  use GroupherServer.TestMate
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias CMS.ArtimentMentions
  alias CMS.Model.ArtimentMention

  @site_host get_config(:general, :site_host)

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
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

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
              "target_type" => "USER",
              "target_id" => mentioned_user.id,
              "children" => [%{"text" => mentioned_user.login}]
            })
          ])
        ])

      {:ok, post} =
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

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
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

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
         ~m(post blog changelog)a do
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

      {:ok, blog} = CMS.Articles.update(blog, %{body: blog_body})
      {:ok, changelog} = CMS.Articles.update(changelog, %{body: changelog_body})

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
              "target_type" => "USER",
              "target_id" => user.id,
              "children" => [%{"text" => user.login}]
            })
          ])
        ])

      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      self_body =
        body
        |> Jason.decode!()
        |> put_in(
          [Access.at(0), "children", Access.at(0), "text"],
          ~s(<a href="#{@site_host}/post/#{post.id}">self</a>)
        )
        |> Jason.encode!()

      {:ok, post} = CMS.Articles.update(post, %{body: self_body})
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
          plate_body([block("block-b", [text("https://example.com/changed")])])
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

    test "deletes old mentions when the current content has none",
         ~m(community post_attrs blog user)a do
      body =
        plate_body([
          block("block-a", [text(~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>))])
        ])

      {:ok, post} =
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      {:ok, post} =
        CMS.Articles.update(post, %{
          body: plate_body([block("block-b", [text("clean content without mentions")])])
        })

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
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

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
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

      {:ok, {1, nil}} = ArtimentMentions.sync(post)
      {:ok, result} = ArtimentMentions.mentioned_by(:blog, blog.id, %{page: 1, size: 10})
      assert result.total_count == 1

      {:ok, _} = CMS.Articles.delete(post)

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
