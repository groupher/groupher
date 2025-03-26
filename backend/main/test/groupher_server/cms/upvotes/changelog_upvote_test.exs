defmodule GroupherServer.Test.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community changelog)a}
  end

  describe "[cms changelog upvote]" do
    @tag :wip
    test "changelog can be upvote && upvotes_count should inc by 1",
         ~m(user user2 community changelog)a do
      {:ok, article} = CMS.upvote_article(changelog, user)
      assert article.id == changelog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.upvote_article(changelog, user2)
      assert article.upvotes_count == 2
    end

    @tag :wip
    test "upvote a already upvoted changelog is fine", ~m(user community changelog)a do
      {:ok, article} = CMS.upvote_article(changelog, user)
      {:error, _error} = CMS.upvote_article(changelog, user)

      assert article.upvotes_count == 1
    end

    @tag :wip
    test "changelog can be undo upvote && upvotes_count should dec by 1",
         ~m(user user2 community changelog)a do
      {:ok, article} = CMS.upvote_article(changelog, user)
      assert article.id == changelog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.undo_upvote_article(changelog, user2)
      assert article.upvotes_count == 0
    end

    @tag :wip
    test "can get upvotes_users", ~m(user user2 community changelog)a do
      {:ok, _article} = CMS.upvote_article(changelog, user)
      {:ok, _article} = CMS.upvote_article(changelog, user2)

      {:ok, users} = CMS.upvoted_users(changelog, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    @tag :wip2
    test "changelog meta history should be updated after upvote",
         ~m(user user2 community changelog)a do
      {:ok, article} = CMS.upvote_article(changelog, user)
      assert user.id in article.meta.upvoted_user_ids

      {:ok, article} = CMS.upvote_article(changelog, user2)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user.id in changelog.meta.upvoted_user_ids
      assert user2.id in changelog.meta.upvoted_user_ids
    end

    @tag :wip2
    test "changelog meta history should be updated after undo upvote",
         ~m(user user2 community changelog)a do
      {:ok, _} = CMS.upvote_article(changelog, user)
      {:ok, _} = CMS.upvote_article(changelog, user2)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user.id in changelog.meta.upvoted_user_ids
      assert user2.id in changelog.meta.upvoted_user_ids

      {:ok, _} = CMS.undo_upvote_article(changelog, user2)
      {:ok, _} = CMS.undo_upvote_article(changelog, user)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert user2.id not in changelog.meta.upvoted_user_ids
      assert user.id not in changelog.meta.upvoted_user_ids
    end
  end
end
