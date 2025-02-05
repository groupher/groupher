defmodule GroupherServer.Test.Community.CommunityMeta do
  @moduledoc false

  use GroupherServer.TestTools

  import Helper.Utils, only: [strip_struct: 1]

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Embeds}

  alias Helper.{ORM}

  @default_meta Embeds.CommunityMeta.default_meta()

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, community2} = db_insert(:community)
    {:ok, community3} = db_insert(:community)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})

    {:ok, ~m(user community community2 community3 community_attrs)a}
  end

  describe "[article count meta]" do
    test "created community should have default meta ", ~m(community_attrs)a do
      {:ok, community} = CMS.create_community(community_attrs)

      assert community.meta |> strip_struct ==
               @default_meta |> Map.merge(%{moderators_ids: [community.user_id]})
    end

    test "update legacy community should add default meta", ~m(community)a do
      assert is_nil(community.meta)

      {:ok, community} = CMS.update_community(community.id, %{title: "new title"})
      assert community.meta |> strip_struct == @default_meta
    end

    test "create a post should inc posts_count in meta",
         ~m(user community community2 community3)a do
      post_attrs = mock_attrs(:post)
      post_attrs2 = mock_attrs(:post)

      {:ok, _post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _post} = CMS.create_article(community, :post, post_attrs2, user)

      {:ok, _post} = CMS.create_article(community2, :post, post_attrs, user)
      {:ok, _post} = CMS.create_article(community3, :post, post_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.articles_count == 2
      assert community.meta.posts_count == 2

      {:ok, community2} = ORM.find(Community, community2.id)
      assert community2.articles_count == 1
      assert community2.meta.posts_count == 1
    end

    test "create a post should inc changelogs_count in meta",
         ~m(user community community2 community3)a do
      changelog_attrs = mock_attrs(:changelog)
      changelog_attrs2 = mock_attrs(:changelog)

      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs2, user)

      {:ok, _} = CMS.create_article(community2, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.create_article(community3, :changelog, changelog_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.articles_count == 2
      assert community.meta.changelogs_count == 2

      {:ok, community2} = ORM.find(Community, community2.id)
      assert community2.articles_count == 1
      assert community2.meta.changelogs_count == 1
    end
  end
end
