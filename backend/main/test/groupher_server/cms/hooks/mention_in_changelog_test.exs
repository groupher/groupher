defmodule GroupherServer.Test.CMS.Hooks.MentionInChangelog do
  use GroupherServer.TestTools

  import GroupherServer.CMS.Delegate.Helper, only: [preload_author: 1]

  alias GroupherServer.{CMS, Delivery}
  alias CMS.Delegate.Hooks

  @article_mention_class "cdx-mention"

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)
    {:ok, changelog} = db_insert(:changelog)

    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user user2 user3 community changelog changelog_attrs)a}
  end

  describe "[mention in changelog basic]" do
    test "mention multi user in changelog should work",
         ~m(user user2 user3 community  changelog_attrs)a do
      body =
        mock_rich_text(
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>, and <div class=#{@article_mention_class}>#{user3.login}</div>),
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>)
        )

      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = preload_author(changelog)

      {:ok, _result} = Hooks.Mention.handle(changelog)

      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "CHANGELOG"
      assert mention.block_linker |> length == 2
      assert mention.article_id == changelog.id
      assert mention.title == changelog.title
      assert mention.user.login == changelog.author.user.login

      {:ok, result} = Delivery.fetch(:mention, user3, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "CHANGELOG"
      assert mention.block_linker |> length == 1
      assert mention.article_id == changelog.id
      assert mention.title == changelog.title
      assert mention.user.login == changelog.author.user.login
    end

    test "mention in changelog's comment should work", ~m(user user2 changelog)a do
      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>))

      {:ok, comment} = CMS.create_comment(:changelog, changelog.id, comment_body, user)
      {:ok, comment} = preload_author(comment)

      {:ok, _result} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "CHANGELOG"
      assert mention.comment_id == comment.id
      assert mention.block_linker |> length == 1
      assert mention.article_id == changelog.id
      assert mention.title == changelog.title
      assert mention.user.login == comment.author.login
    end

    test "can not mention author self in changelog or comment",
         ~m(community user changelog_attrs)a do
      body = mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))
      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})
      assert result.total_count == 0

      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))

      {:ok, comment} = CMS.create_comment(:changelog, changelog.id, comment_body, user)

      {:ok, _result} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})

      assert result.total_count == 0
    end
  end
end
