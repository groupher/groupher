defmodule GroupherServer.Test.CMS.ChangelogMeta do
  @moduledoc false
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS

  alias CMS.Model.{Embeds, Author, Changelog}

  @default_article_meta Embeds.ArticleMeta.default_meta()

  setup do
    {:ok, user} = db_insert(:user)
    # {:ok, changelog} = db_insert(:changelog)
    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user community changelog_attrs)a}
  end

  describe "[cms changelog meta info]" do
    test "can get default meta info", ~m(user community changelog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = ORM.find_by(Changelog, id: changelog.id)
      meta = changelog.meta |> Map.from_struct() |> Map.delete(:id)

      assert meta == @default_article_meta |> Map.merge(%{thread: "CHANGELOG"})
    end

    test "is_edited flag should set to true after changelog updated",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = ORM.find_by(Changelog, id: changelog.id)

      assert not changelog.meta.is_edited

      {:ok, _} = CMS.update_article(changelog, %{"title" => "new title"})
      {:ok, changelog} = ORM.find_by(Changelog, id: changelog.id)

      assert changelog.meta.is_edited
    end

    test "changelog's lock/undo_lock article should work", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert not changelog.meta.is_comment_locked

      {:ok, _} = CMS.lock_article_comments(:changelog, changelog.id)
      {:ok, changelog} = ORM.find_by(Changelog, id: changelog.id)

      assert changelog.meta.is_comment_locked

      {:ok, _} = CMS.undo_lock_article_comments(:changelog, changelog.id)
      {:ok, changelog} = ORM.find_by(Changelog, id: changelog.id)

      assert not changelog.meta.is_comment_locked
    end

    # TODO:
    # test "changelog with image should have imageCount in meta" do
    # end

    # TODO:
    # test "changelog with video should have imageCount in meta" do
    # end
  end
end
