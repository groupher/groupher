defmodule GroupherServer.Test.CMS.Communities.Tags.ChangelogTagTest do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.CommunityTag

  alias GroupherServer.CMS

  setup do
    {community, changelog, changelog_attrs, user} = mock_article(:changelog)

    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community changelog changelog_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[changelog tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group == article_tag_attrs.group
    end

    test "create article tag with extra & icon data", ~m(community article_tag_attrs user)a do
      tag_attrs = Map.merge(article_tag_attrs, %{extra: ["menuID", "menuID2"], icon: "icon addr"})
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]
      assert article_tag.icon == "icon addr"
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title"})

      {:ok, article_tag} = CMS.Communities.update_tag(article_tag.id, new_attrs)
      assert article_tag.title == "new title"
    end

    test "create article tag with non-exist community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.Communities.create_tag(
                 %Community{slug: non_exist_slug()},
                 :changelog,
                 article_tag_attrs,
                 user
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)
      {:ok, article_tag} = ORM.find(CommunityTag, article_tag.id)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      assert {:error, _} = ORM.find(CommunityTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community changelog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag.id)
      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag2.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :community_tags)
      assert exist_in?(article_tag, changelog.community_tags)
      assert exist_in?(article_tag2, changelog.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :community_tags)
      assert not exist_in?(article_tag, changelog.community_tags)
      assert exist_in?(article_tag2, changelog.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag2.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :community_tags)
      assert not exist_in?(article_tag, changelog.community_tags)
      assert not exist_in?(article_tag2, changelog.community_tags)
    end
  end

  describe "[create/update changelog with tags]" do
    test "can create changelog with existed article tags",
         ~m(community user changelog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :changelog, article_tag_attrs2, user)

      changelog_with_tags =
        Map.merge(changelog_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:ok, created} = CMS.Articles.create(community, :changelog, changelog_with_tags, user)
      {:ok, changelog} = ORM.find(Changelog, created.id, preload: :community_tags)

      assert exist_in?(article_tag, changelog.community_tags)
      assert exist_in?(article_tag2, changelog.community_tags)
    end

    test "can not create changelog with other community's article tags",
         ~m(community user changelog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = db_insert(:community)
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community2, :changelog, article_tag_attrs2, user)

      changelog_with_tags =
        Map.merge(changelog_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.Articles.create(community, :changelog, changelog_with_tags, user)
      is_error?(reason, :invalid_domain_tag)
    end
  end

  describe "[changelog tag set /unset]" do
    test "can set a tag ", ~m(community changelog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag.id)
      assert changelog.community_tags |> length == 1
      assert exist_in?(article_tag, changelog.community_tags)

      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag2.id)
      assert changelog.community_tags |> length == 2
      assert exist_in?(article_tag, changelog.community_tags)
      assert exist_in?(article_tag2, changelog.community_tags)

      {:ok, changelog} = CMS.Communities.unset_tag(changelog, article_tag.id)
      assert changelog.community_tags |> length == 1
      assert not exist_in?(article_tag, changelog.community_tags)
      assert exist_in?(article_tag2, changelog.community_tags)

      {:ok, changelog} = CMS.Communities.unset_tag(changelog, article_tag2.id)
      assert changelog.community_tags |> length == 0
      assert not exist_in?(article_tag, changelog.community_tags)
      assert not exist_in?(article_tag2, changelog.community_tags)
    end

    test "can not set dup tag ", ~m(community changelog article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :changelog, article_tag_attrs, user)
      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag.id)
      {:ok, changelog} = CMS.Communities.set_tag(changelog, article_tag.id)

      assert changelog.community_tags |> length == 1
    end
  end
end
