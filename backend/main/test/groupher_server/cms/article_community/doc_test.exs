defmodule GroupherServer.Test.CMS.ArticleCommunity.Doc do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)

    {:ok, home_community} = mock_community(user, %{slug: "home"})
    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    {:ok, community2} = mock_community()
    {:ok, community3} = mock_community()

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    {:ok, ~m(user user2 community community2 community3 home_community blackhole doc doc_attrs)a}
  end

  describe "[article mirror/move]" do
    test "created doc has original community info", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc} = ORM.find(Doc, doc.id, preload: :community)

      assert doc.community_id == community.id
    end

    test "doc can be move to other community",
         ~m(user community community2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.community_id == community.id

      {:ok, _} = CMS.move_article(community2, doc)

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities])

      assert doc.community.id == community2.id
      assert exist_in?(community2, doc.communities)
    end

    test "tags should be clean after doc move to other community",
         ~m(user community community2 doc_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :doc, article_tag_attrs2, user)

      {:ok, _} = CMS.set_article_tag(doc, article_tag.id)
      {:ok, doc} = CMS.set_article_tag(doc, article_tag2.id)

      assert doc.article_tags |> length == 2
      assert doc.community_id == community.id

      {:ok, _} = CMS.move_article(community2, doc)

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities, :article_tags])

      assert doc.article_tags |> length == 0
      assert doc.community.id == community2.id
      assert exist_in?(community2, doc.communities)
    end

    test "doc move to other community with new tag",
         ~m(user community community2 doc_attrs)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(community, :doc, article_tag_attrs0, user)

      {:ok, article_tag} = CMS.create_article_tag(community2, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :doc, article_tag_attrs2, user)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.set_article_tag(doc, article_tag0.id)
      {:ok, _} = CMS.set_article_tag(doc, article_tag.id)
      {:ok, _} = CMS.set_article_tag(doc, article_tag2.id)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: [:article_tags])
      assert doc.article_tags |> length == 3

      {:ok, _} =
        CMS.move_article(community2, doc, [
          article_tag.id,
          article_tag2.id
        ])

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities, :article_tags])

      assert doc.community.id == community2.id
      assert doc.article_tags |> length == 2

      assert not exist_in?(article_tag0, doc.article_tags)
      assert exist_in?(article_tag, doc.article_tags)
      assert exist_in?(article_tag2, doc.article_tags)
    end

    test "doc can be mirror to other community",
         ~m(user community community2 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :communities)
      assert doc.communities |> length == 1

      assert exist_in?(community, doc.communities)

      {:ok, _} = CMS.mirror_article(community2, doc)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :communities)
      assert doc.communities |> length == 2

      assert exist_in?(community, doc.communities)
      assert exist_in?(community2, doc.communities)
    end

    test "doc can be mirror to other community with tags",
         ~m(user community community2 doc_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community2, :doc, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :doc, article_tag_attrs2, user)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

      {:ok, _} =
        CMS.mirror_article(community2, doc, [
          article_tag.id,
          article_tag2.id
        ])

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :article_tags)
      assert doc.article_tags |> length == 2

      assert exist_in?(article_tag, doc.article_tags)
      assert exist_in?(article_tag2, doc.article_tags)
    end

    test "doc can be unmirror from community",
         ~m(user community community2 community3 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, doc)
      {:ok, _} = CMS.mirror_article(community3, doc)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :communities)
      assert doc.communities |> length == 3

      {:ok, _} = CMS.unmirror_article(community3, doc)
      {:ok, doc} = ORM.find(Doc, doc.id, preload: :communities)
      assert doc.communities |> length == 2

      assert not exist_in?(community3, doc.communities)
    end

    test "doc can be unmirror from community with tags",
         ~m(user community community2 community3 doc_attrs)a do
      article_tag_attrs2 = mock_attrs(:article_tag)
      article_tag_attrs3 = mock_attrs(:article_tag)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :doc, article_tag_attrs2, user)

      {:ok, article_tag3} =
        CMS.create_article_tag(community3, :doc, article_tag_attrs3, user)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, doc, [article_tag2.id])
      {:ok, _} = CMS.mirror_article(community3, doc, [article_tag3.id])

      {:ok, _} = CMS.unmirror_article(community3, doc)
      {:ok, doc} = ORM.find(Doc, doc.id, preload: :article_tags)

      assert exist_in?(article_tag2, doc.article_tags)
      assert not exist_in?(article_tag3, doc.article_tags)
    end

    test "doc can not unmirror from original community",
         ~m(user community community2 community3 doc_attrs)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, doc)
      {:ok, _} = CMS.mirror_article(community3, doc)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :communities)
      assert doc.communities |> length == 3

      {:error, reason} = CMS.unmirror_article(community, doc)
      assert reason |> is_error?(:mirror_article)
    end

    test "doc can be mirror to home", ~m(community home_community doc_attrs user)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, doc)

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities])

      assert doc.community_id == community.id
      assert doc.communities |> length == 2

      assert exist_in?(community, doc.communities)
      assert exist_in?(home_community, doc.communities)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:doc, filter)

      assert exist_in?(doc, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:doc, filter)

      assert exist_in?(doc, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "doc can be mirror to home with tags", ~m(community home_community doc_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(home_community, :doc, article_tag_attrs0, user)

      {:ok, article_tag} =
        CMS.create_article_tag(home_community, :doc, article_tag_attrs, user)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, doc, [article_tag0.id, article_tag.id])

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities, :article_tags])

      assert doc.community_id == community.id
      assert doc.communities |> length == 2

      assert exist_in?(community, doc.communities)
      assert exist_in?(home_community, doc.communities)

      assert doc.article_tags |> length == 2
      assert exist_in?(article_tag0, doc.article_tags)
      assert exist_in?(article_tag, doc.article_tags)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:doc, filter)

      assert exist_in?(doc, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:doc, filter)

      assert exist_in?(doc, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "doc can be move to blackhole", ~m(community blackhole doc_attrs user)a do
      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      assert doc.community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, doc)

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities])

      assert doc.community.id == blackhole.id
      assert doc.communities |> length == 1

      assert exist_in?(blackhole, doc.communities)

      filter = %{page: 1, size: 10, community: blackhole.slug}
      {:ok, paged_articles} = CMS.paged_articles(:doc, filter)

      assert exist_in?(doc, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    test "doc can be move to blackhole with tags", ~m(community blackhole doc_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(blackhole, :doc, article_tag_attrs0, user)

      {:ok, article_tag} =
        CMS.create_article_tag(blackhole, :doc, article_tag_attrs, user)

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, _} = CMS.set_article_tag(doc, article_tag0.id)

      assert doc.community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, doc, [article_tag.id])

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:community, :communities, :article_tags])

      assert doc.community.id == blackhole.id
      assert doc.communities |> length == 1
      assert doc.article_tags |> length == 1

      assert exist_in?(blackhole, doc.communities)
      assert exist_in?(article_tag, doc.article_tags)
    end
  end
end
