defmodule GroupherServer.Test.CMS.ArticleCommunity.Changelog do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)

    {:ok, home_community} = mock_community(user, %{slug: "home"})
    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok,
     ~m(user user2 community community2 community3 home_community blackhole changelog changelog_attrs)a}
  end

  describe "[article mirror/move]" do
    test "created changelog has original community info", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :original_community)

      assert changelog.original_community_id == community.id
    end

    test "changelog can be move to other community",
         ~m(user community community2 changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.move_article(community2, changelog)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id, preload: [:original_community, :communities])

      assert changelog.original_community.id == community2.id
      assert exist_in?(community2, changelog.communities)
    end

    test "tags should be clean after changelog move to other community",
         ~m(user community community2 changelog_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :changelog, article_tag_attrs2, user)

      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)
      {:ok, changelog} = CMS.set_article_tag(:changelog, changelog.id, article_tag2.id)

      assert changelog.article_tags |> length == 2
      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.move_article(community2, changelog)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id,
          preload: [:original_community, :communities, :article_tags]
        )

      assert changelog.article_tags |> length == 0
      assert changelog.original_community.id == community2.id
      assert exist_in?(community2, changelog.communities)
    end

    test "changelog move to other community with new tag",
         ~m(user community community2 changelog_attrs)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(community, :changelog, article_tag_attrs0, user)

      {:ok, article_tag} = CMS.create_article_tag(community2, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag0.id)
      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag.id)
      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag2.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: [:article_tags])
      assert changelog.article_tags |> length == 3

      {:ok, _} = CMS.move_article(community2, changelog, [article_tag.id, article_tag2.id])

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id,
          preload: [:original_community, :communities, :article_tags]
        )

      assert changelog.original_community.id == community2.id
      assert changelog.article_tags |> length == 2

      assert not exist_in?(article_tag0, changelog.article_tags)
      assert exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)
    end

    test "changelog can be mirror to other community",
         ~m(user community community2 changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :communities)
      assert changelog.communities |> length == 1

      assert exist_in?(community, changelog.communities)

      {:ok, _} = CMS.mirror_article(community2, changelog)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :communities)
      assert changelog.communities |> length == 2

      assert exist_in?(community, changelog.communities)
      assert exist_in?(community2, changelog.communities)
    end

    test "changelog can be mirror to other community with tags",
         ~m(user community community2 changelog_attrs)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community2, :changelog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :changelog, article_tag_attrs2, user)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, _} =
        CMS.mirror_article(community2, changelog, [
          article_tag.id,
          article_tag2.id
        ])

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :article_tags)
      assert changelog.article_tags |> length == 2

      assert exist_in?(article_tag, changelog.article_tags)
      assert exist_in?(article_tag2, changelog.article_tags)
    end

    test "changelog can be unmirror from community",
         ~m(user community community2 community3 changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, changelog)
      {:ok, _} = CMS.mirror_article(community3, changelog)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :communities)
      assert changelog.communities |> length == 3

      {:ok, _} = CMS.unmirror_article(community3, changelog)
      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :communities)
      assert changelog.communities |> length == 2

      assert not exist_in?(community3, changelog.communities)
    end

    test "changelog can be unmirror from community with tags",
         ~m(user community community2 community3 changelog_attrs)a do
      article_tag_attrs2 = mock_attrs(:article_tag)
      article_tag_attrs3 = mock_attrs(:article_tag)

      {:ok, article_tag2} =
        CMS.create_article_tag(community2, :changelog, article_tag_attrs2, user)

      {:ok, article_tag3} =
        CMS.create_article_tag(community3, :changelog, article_tag_attrs3, user)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, changelog, [article_tag2.id])
      {:ok, _} = CMS.mirror_article(community3, changelog, [article_tag3.id])

      {:ok, _} = CMS.unmirror_article(community3, changelog)
      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :article_tags)

      assert exist_in?(article_tag2, changelog.article_tags)
      assert not exist_in?(article_tag3, changelog.article_tags)
    end

    test "changelog can not unmirror from original community",
         ~m(user community community2 community3 changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.mirror_article(community2, changelog)
      {:ok, _} = CMS.mirror_article(community3, changelog)

      {:ok, changelog} = ORM.find(Changelog, changelog.id, preload: :communities)
      assert changelog.communities |> length == 3

      {:error, reason} = CMS.unmirror_article(community, changelog)
      assert reason |> is_error?(:mirror_article)
    end

    @tag :wip
    test "changelog can be mirror to home", ~m(community home_community changelog_attrs user)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, changelog)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id, preload: [:original_community, :communities])

      assert changelog.original_community_id == community.id
      assert changelog.communities |> length == 2

      assert exist_in?(community, changelog.communities)
      assert exist_in?(home_community, changelog.communities)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:changelog, filter)

      assert exist_in?(changelog, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:changelog, filter)

      assert exist_in?(changelog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    @tag :wip
    test "changelog can be mirror to home with tags",
         ~m(community home_community changelog_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(home_community, :changelog, article_tag_attrs0, user)

      {:ok, article_tag} =
        CMS.create_article_tag(home_community, :changelog, article_tag_attrs, user)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.mirror_to_home(home_community, changelog, [article_tag0.id, article_tag.id])

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id,
          preload: [:original_community, :communities, :article_tags]
        )

      assert changelog.original_community_id == community.id
      assert changelog.communities |> length == 2

      assert exist_in?(community, changelog.communities)
      assert exist_in?(home_community, changelog.communities)

      assert changelog.article_tags |> length == 2
      assert exist_in?(article_tag0, changelog.article_tags)
      assert exist_in?(article_tag, changelog.article_tags)

      filter = %{page: 1, size: 10, community: community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:changelog, filter)

      assert exist_in?(changelog, paged_articles.entries)
      assert paged_articles.total_count === 2

      filter = %{page: 1, size: 10, community: home_community.slug}
      {:ok, paged_articles} = CMS.paged_articles(:changelog, filter)

      assert exist_in?(changelog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    @tag :wip
    test "changelog can be move to blackhole", ~m(community blackhole changelog_attrs user)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, changelog)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id, preload: [:original_community, :communities])

      assert changelog.original_community.id == blackhole.id
      assert changelog.communities |> length == 1

      assert exist_in?(blackhole, changelog.communities)

      filter = %{page: 1, size: 10, community: blackhole.slug}
      {:ok, paged_articles} = CMS.paged_articles(:changelog, filter)

      assert exist_in?(changelog, paged_articles.entries)
      assert paged_articles.total_count === 1
    end

    @tag :wip
    test "changelog can be move to blackhole with tags",
         ~m(community blackhole changelog_attrs user)a do
      article_tag_attrs0 = mock_attrs(:article_tag)
      article_tag_attrs = mock_attrs(:article_tag)

      {:ok, article_tag0} =
        CMS.create_article_tag(blackhole, :changelog, article_tag_attrs0, user)

      {:ok, article_tag} =
        CMS.create_article_tag(blackhole, :changelog, article_tag_attrs, user)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.set_article_tag(:changelog, changelog.id, article_tag0.id)

      assert changelog.original_community_id == community.id

      {:ok, _} = CMS.move_to_blackhole(blackhole, changelog, [article_tag.id])

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id,
          preload: [:original_community, :communities, :article_tags]
        )

      assert changelog.original_community.id == blackhole.id
      assert changelog.communities |> length == 1
      assert changelog.article_tags |> length == 1

      assert exist_in?(blackhole, changelog.communities)
      assert exist_in?(article_tag, changelog.article_tags)
    end
  end
end
