defmodule GroupherServer.Test.CMS.Communities.Tags.DocTagTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.CommunityTag

  alias GroupherServer.CMS

  setup do
    {community, doc, doc_attrs, user} = mock_article(:doc)

    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community doc doc_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[doc tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)
      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group_id
    end

    test "create article tag with extra & icon data", ~m(community article_tag_attrs user)a do
      tag_attrs = Map.merge(article_tag_attrs, %{extra: ["menuID", "menuID2"], icon: "icon addr"})
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, tag_attrs, user)

      assert article_tag.extra == ["menuID", "menuID2"]
      assert article_tag.icon == "icon addr"
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title"})

      {:ok, article_tag} = CMS.Communities.update_tag(article_tag.id, new_attrs)
      assert article_tag.title == "new title"
    end

    test "create article tag with non-exist community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.Communities.create_tag(
                 %Community{slug: non_exist_slug()},
                 :doc,
                 article_tag_attrs,
                 user
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)
      {:ok, article_tag} = ORM.find(CommunityTag, article_tag.id)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      assert {:error, _} = ORM.find(CommunityTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community doc article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :doc, article_tag_attrs2, user)

      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag.id)
      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag2.id)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :community_tags)
      assert exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :community_tags)
      assert not exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag2.id)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :community_tags)
      assert not exist_in?(article_tag, doc.community_tags)
      assert not exist_in?(article_tag2, doc.community_tags)
    end
  end

  describe "[create/update doc with tags]" do
    test "can create doc with existed community tags",
         ~m(community user doc_attrs article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :doc, article_tag_attrs2, user)

      doc_with_tags =
        Map.merge(doc_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:ok, created} = CMS.Articles.create(community, :doc, doc_with_tags, user)
      {:ok, doc} = ORM.find(Doc, created.id, preload: :community_tags)

      assert exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)
    end

    test "can not create doc with other community's community tags",
         ~m(community user doc_attrs article_tag_attrs article_tag_attrs2)a do
      community2_attrs = mock_attrs(:community)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user)
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community2, :doc, article_tag_attrs2, user)

      doc_with_tags =
        Map.merge(doc_attrs, %{community_tags: [article_tag.id, article_tag2.id]})

      {:error, reason} = CMS.Articles.create(community, :doc, doc_with_tags, user)
      is_error?(reason, :invalid_domain_tag)
    end
  end

  describe "[doc tag set /unset]" do
    test "can set a tag ", ~m(community doc article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.Communities.create_tag(community, :doc, article_tag_attrs2, user)

      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag.id)
      assert doc.community_tags |> length == 1
      assert exist_in?(article_tag, doc.community_tags)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0

      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag2.id)
      assert doc.community_tags |> length == 2
      assert exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, doc} = CMS.Communities.unset_tag(doc, article_tag.id)
      assert doc.community_tags |> length == 1
      assert not exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, doc} = CMS.Communities.unset_tag(doc, article_tag2.id)
      assert doc.community_tags |> length == 0
      assert not exist_in?(article_tag, doc.community_tags)
      assert not exist_in?(article_tag2, doc.community_tags)
    end

    test "can not set dup tag ", ~m(community doc article_tag_attrs user)a do
      {:ok, article_tag} = CMS.Communities.create_tag(community, :doc, article_tag_attrs, user)
      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag.id)
      {:ok, doc} = CMS.Communities.set_tag(doc, article_tag.id)

      assert doc.community_tags |> length == 1
    end
  end
end
