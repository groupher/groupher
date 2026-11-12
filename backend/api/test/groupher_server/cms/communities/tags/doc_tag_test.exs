defmodule GroupherServer.Test.CMS.Communities.Tags.DocTagTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Communities.Tags.Maintenance
  alias GroupherServer.CMS
  alias CMS.Model.CommunityTag

  setup do
    {community, doc, doc_attrs, user} = mock_article(:doc)

    article_tag_attrs = mock_attrs(:community_tag)
    article_tag_attrs2 = mock_attrs(:community_tag)

    {:ok, ~m(user community doc doc_attrs article_tag_attrs article_tag_attrs2)a}
  end

  describe "[doc tag CRUD]" do
    test "create article tag with valid data", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      assert article_tag.title == article_tag_attrs.title
      assert article_tag.group_id
    end

    test "create article tag with extra & marker data", ~m(community article_tag_attrs user)a do
      tag_attrs =
        Map.merge(article_tag_attrs, %{
          extra: ["menuID", "menuID2"],
          marker: %{type: "ICON", provider: "lucide", name: "tag", src: "/icons/lucide/tag.svg"}
        })

      {:ok, article_tag} =
        CMS.Communities.create_tag(community, :doc, tag_attrs, user, Ecto.UUID.generate())

      assert article_tag.extra == ["menuID", "menuID2"]

      assert article_tag.marker == %{
               type: :icon,
               provider: "lucide",
               name: "tag",
               src: "/icons/lucide/tag.svg"
             }
    end

    test "can update an article tag", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      new_attrs = article_tag_attrs |> Map.merge(%{title: "new title"})

      {:ok, article_tag} =
        CMS.Communities.update_tag(article_tag.id, new_attrs, user, Ecto.UUID.generate())

      assert article_tag.title == "new title"
    end

    test "create article tag with non-exist community fails", ~m(article_tag_attrs user)a do
      assert {:error, _} =
               CMS.Communities.create_tag(
                 %Community{slug: non_exist_slug()},
                 :doc,
                 article_tag_attrs,
                 user,
                 Ecto.UUID.generate()
               )
    end

    test "tag can be deleted", ~m(community article_tag_attrs user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, article_tag} = ORM.find(CommunityTag, article_tag.id)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id, user, Ecto.UUID.generate())

      assert {:error, _} = ORM.find(CommunityTag, article_tag.id)
    end

    test "assoc tag should be delete after tag deleted",
         ~m(community doc article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, article_tag2} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      {:ok, doc} = Maintenance.add(doc, article_tag.id, "test:tag-assoc:#{doc.id}")
      {:ok, doc} = Maintenance.add(doc, article_tag2.id, "test:tag-assoc:#{doc.id}")

      {:ok, tags} = binding_tags(doc, community)
      assert exist_in?(article_tag, tags)
      assert exist_in?(article_tag2, tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag.id, user, Ecto.UUID.generate())

      {:ok, tags} = binding_tags(doc, community)
      assert not exist_in?(article_tag, tags)
      assert exist_in?(article_tag2, tags)

      {:ok, _} = CMS.Communities.delete_tag(article_tag2.id, user, Ecto.UUID.generate())

      {:ok, tags} = binding_tags(doc, community)
      assert not exist_in?(article_tag, tags)
      assert not exist_in?(article_tag2, tags)
    end
  end

  describe "[Doc community binding tags]" do
    test "can assign existing community tags without changing the published Snapshot",
         ~m(community user doc article_tag_attrs article_tag_attrs2)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, article_tag2} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      public = Repo.get!(CMS.Model.ArticlePublic, doc.id)
      {:ok, _} = CMS.Communities.set_tag(doc, article_tag.id, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Communities.set_tag(doc, article_tag2.id, user, Ecto.UUID.generate())
      assert Repo.get!(CMS.Model.ArticlePublic, doc.id).snapshot_id == public.snapshot_id

      {:ok, tags} = binding_tags(doc, community)

      assert exist_in?(article_tag, tags)
      assert exist_in?(article_tag2, tags)
    end

    test "cannot assign tags from an unbound community",
         ~m(community user doc article_tag_attrs article_tag_attrs2)a do
      community2_attrs = mock_attrs(:community)

      {:ok, community2} =
        CMS.Communities.create(community2_attrs, user, Ecto.UUID.generate())

      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, article_tag2} =
        CMS.Communities.create_tag(
          community2,
          :doc,
          article_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} = CMS.Communities.set_tag(doc, article_tag.id, user, Ecto.UUID.generate())

      assert {:error, _} =
               CMS.Communities.set_tag(doc, article_tag2.id, user, Ecto.UUID.generate())

      {:ok, tags} = binding_tags(doc, community)
      assert exist_in?(article_tag, tags)
      refute exist_in?(article_tag2, tags)
    end
  end

  describe "[doc tag set /unset]" do
    test "can set a tag ", ~m(community doc article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, article_tag2} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      {:ok, doc} = Maintenance.add(doc, article_tag.id, "test:tag-assoc:#{doc.id}")
      assert doc.community_tags |> length == 1
      assert exist_in?(article_tag, doc.community_tags)

      {:ok, stat} = CMS.Communities.tag_stats(article_tag)
      assert stat.contents_count == 0
      assert stat.today_contents_count == 0

      {:ok, doc} = Maintenance.add(doc, article_tag2.id, "test:tag-assoc:#{doc.id}")
      assert doc.community_tags |> length == 2
      assert exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, doc} = Maintenance.remove(doc, article_tag.id, "test:tag-assoc:#{doc.id}")
      assert doc.community_tags |> length == 1
      assert not exist_in?(article_tag, doc.community_tags)
      assert exist_in?(article_tag2, doc.community_tags)

      {:ok, doc} = Maintenance.remove(doc, article_tag2.id, "test:tag-assoc:#{doc.id}")
      assert doc.community_tags |> length == 0
      assert not exist_in?(article_tag, doc.community_tags)
      assert not exist_in?(article_tag2, doc.community_tags)
    end

    test "can not set dup tag ", ~m(community doc article_tag_attrs user)a do
      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community,
          :doc,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, doc} = Maintenance.add(doc, article_tag.id, "test:tag-assoc:#{doc.id}")
      {:ok, doc} = Maintenance.add(doc, article_tag.id, "test:tag-assoc:#{doc.id}")

      assert doc.community_tags |> length == 1
    end
  end
end
