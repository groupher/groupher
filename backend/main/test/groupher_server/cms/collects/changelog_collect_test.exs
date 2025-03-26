defmodule GroupherServer.Test.Collect.Changelog do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community changelog)a}
  end

  describe "[cms changelog collect]" do
    test "changelog can be collect && collects_count should inc by 1",
         ~m(user user2 community changelog)a do
      {:ok, article_collect} = CMS.collect_article(changelog, user)
      {:ok, article} = ORM.find(Changelog, article_collect.changelog_id)

      assert article.id == changelog.id
      assert article.collects_count == 1

      {:ok, article_collect} = CMS.collect_article(changelog, user2)
      {:ok, article} = ORM.find(Changelog, article_collect.changelog_id)

      assert article.collects_count == 2
    end

    test "changelog can be undo collect && collects_count should dec by 1",
         ~m(user community changelog)a do
      {:ok, _} = CMS.collect_article(changelog, user)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert changelog.collects_count == 1

      {:ok, _} = CMS.undo_collect_article(changelog, user)
      {:ok, article} = ORM.find(Changelog, changelog.id)

      assert article.collects_count == 0
    end

    test "can get collect_users", ~m(user user2 community changelog)a do
      {:ok, _} = CMS.collect_article(changelog, user)
      {:ok, _} = CMS.collect_article(changelog, user2)

      {:ok, users} = CMS.collected_users(changelog, %{page: 1, size: 2})

      assert users |> is_valid_pagination?(:raw)
      assert user_exist_in?(user, users.entries)
      assert user_exist_in?(user2, users.entries)
    end

    test "changelog meta history should be updated", ~m(user user2 community changelog)a do
      {:ok, _} = CMS.collect_article(changelog, user)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert user.id in changelog.meta.collected_user_ids

      {:ok, _} = CMS.collect_article(changelog, user2)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user.id in changelog.meta.collected_user_ids
      assert user2.id in changelog.meta.collected_user_ids
    end

    test "changelog meta history should be updated after undo collect",
         ~m(user user2 community changelog)a do
      {:ok, _} = CMS.collect_article(changelog, user)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, _} = CMS.collect_article(changelog, user2)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert user.id in changelog.meta.collected_user_ids
      assert user2.id in changelog.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(changelog, user2)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user2.id not in changelog.meta.collected_user_ids

      {:ok, _} = CMS.undo_collect_article(changelog, user)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)

      assert user.id not in changelog.meta.collected_user_ids
      assert user2.id not in changelog.meta.collected_user_ids
    end
  end
end
