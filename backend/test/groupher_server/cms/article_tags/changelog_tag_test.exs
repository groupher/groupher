defmodule GroupherServer.Test.CMS.ArticleTag.ChangelogTag do
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.{Community, ArticleTag, Changelog}
  alias Helper.{ORM}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, changelog} = db_insert(:changelog)
    {:ok, community} = db_insert(:community)
    article_tag_attrs = mock_attrs(:article_tag)
    article_tag_attrs2 = mock_attrs(:article_tag)

    changelog_attrs = mock_attrs(:changelog)

    {:ok, ~m(user community changelog changelog_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[changelog tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group == article_tag_attrs.group
    end

    test "create article tag with extra & icon data", ~m(community article_tag_attrs user)a do
      tag_attrs = Map.merge(article_tag_attrs, %{extra: ["menuID", "menuID2"], icon: "icon addr"})
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]
      assert article_tag.icon == "icon addr"
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title"})

      {:ok, article_tag} = CMS.update_article_tag(article_tag.id, new_attrs)
      assert article_tag.title == "new title"
    end

    test "create article tag with non-exsit community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.create_article_tag(
                 %Community{slug: non_exsit_slug()},
                 :changelog,
                 article_tag_attrs,
                 user
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      {:ok, article_tag} = ORM.find(ArticleTag, article_tag.id)

      {:ok, _} = CMS.delete_article_tag(article_tag.id)

      assert {:error, _} = ORM.find(ArticleTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community changelog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)
      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag2.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :article_tags)
      assert exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)

      {:ok, _} = CMS.delete_article_tag(article_tag.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :article_tags)
      assert not exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)

      {:ok, _} = CMS.delete_article_tag(article_tag2.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :article_tags)
      assert not exist_in?(article_tag, changelog.article_tags)
      assert not exist_in?(article_tag2, changelog.article_tags)
    end
  end

  describe "[create/update changelog with tags]" do
    test "can create changelog with exsited article tags",
         ~m(community user changelog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :changelog, article_tag_attrs2, user)

      changelog_with_tags =
        Map.merge(changelog_attrs, %{article_tags: [article_tag.id, article_tag2.id]})

      {:ok, created} = CMS.create_article(community, :changelog, changelog_with_tags, user)
      {:ok, changelog} = ORM.find(Changelog, created.id, preload: :article_tags)

      assert exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)
    end

    test "can not create changelog with other community's article tags",
         ~m(community user changelog_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, community2} = db_insert(:community)
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :changelog, article_tag_attrs2, user)

      changelog_with_tags =
        Map.merge(changelog_attrs, %{article_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.create_article(community, :changelog, changelog_with_tags, user)
      is_error?(reason, :invalid_domain_tag)
    end
  end

  describe "[changelog tag set /unset]" do
    test "can set a tag ", ~m(community changelog article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)
      assert changelog.article_tags |> length == 1
      assert exist_in?(article_tag, changelog.article_tags)

      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag2.id)
      assert changelog.article_tags |> length == 2
      assert exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)

      {:ok, changelog} = CMS.unset_article_tag(:changelog, changelog.id, article_tag.id)
      assert changelog.article_tags |> length == 1
      assert not exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)

      {:ok, changelog} = CMS.unset_article_tag(:changelog, changelog.id, article_tag2.id)
      assert changelog.article_tags |> length == 0
      assert not exist_in?(article_tag, changelog.article_tags)
      assert not exist_in?(article_tag2, changelog.article_tags)
    end

    test "can not set dup tag ", ~m(community changelog article_tag_attrs user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)
      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)

      assert changelog.article_tags |> length == 1
    end
  end
end
