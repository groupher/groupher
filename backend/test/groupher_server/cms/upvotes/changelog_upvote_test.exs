defmodule GroupherServer.Test.Upvotes.ChangelogUpvote do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user user2 community changelog_attrs)a}
  end

  describe "[cms changelog upvote]" do
    test "changelog can be upvote && upvotes_count should inc by 1",
         ~m(user user2 community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user)
      assert article.id == changelog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user2)
      assert article.upvotes_count == 2
    end

    test "upvote a already upvoted changelog is fine", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user)

      {:error, _error} = CMS.upvote_article(:changelog, changelog.id, user)

      assert article.upvotes_count == 1
    end

    test "changelog can be undo upvote && upvotes_count should dec by 1",
         ~m(user user2 community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user)
      assert article.id == changelog.id
      assert article.upvotes_count == 1

      {:ok, article} = CMS.undo_upvote_article(:changelog, changelog.id, user2)
      assert article.upvotes_count == 0
    end

    test "can get upvotes_users", ~m(user user2 community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, _article} = CMS.upvote_article(:changelog, changelog.id, user)
      {:ok, _article} = CMS.upvote_article(:changelog, changelog.id, user2)

      {:ok, users} = CMS.upvoted_users(:changelog, changelog.id, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "changelog meta history should be updated after upvote",
         ~m(user user2 community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user)
      assert user.id in article.meta.upvoted_user_ids

      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user2)
      assert user.id in article.meta.upvoted_user_ids
      assert user2.id in article.meta.upvoted_user_ids
    end

    test "changelog meta history should be updated after undo upvote",
         ~m(user user2 community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, _article} = CMS.upvote_article(:changelog, changelog.id, user)
      {:ok, article} = CMS.upvote_article(:changelog, changelog.id, user2)

      assert user.id in article.meta.upvoted_user_ids
      assert user2.id in article.meta.upvoted_user_ids

      {:ok, article} = CMS.undo_upvote_article(:changelog, changelog.id, user2)
      assert user2.id not in article.meta.upvoted_user_ids

      {:ok, article} = CMS.undo_upvote_article(:changelog, changelog.id, user)
      assert user.id not in article.meta.upvoted_user_ids
    end
  end
end
