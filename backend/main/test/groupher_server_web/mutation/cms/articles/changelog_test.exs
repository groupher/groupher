defmodule GroupherServer.Test.Mutation.Articles.Changelog do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    {:ok, ~m(user_conn guest_conn owner_conn user community changelog)a}
  end

  describe "[mutation changelog curd]" do
    test "create changelog with valid attrs and make sure author exist",
         ~m(user_conn user community)a do
      changelog_attr = mock_attrs(:changelog) |> Map.merge(%{linkAddr: "https://helloworld"})

      body = """
      {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 red chevron。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      """

      variables = changelog_attr |> Map.merge(%{community: community.slug, body: body})
      result = user_conn |> gq_mutation(Schema.m(:create_article, :changelog), variables)

      {:ok, changelog} = CMS.FrontDesk.article(community, :changelog, result["innerId"])

      assert result["innerId"] == to_string(changelog.inner_id)
      assert result["community"]["id"] == to_string(community.id)
      assert result["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    test "create changelog with valid tags id list", ~m(user_conn user community)a do
      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs,
          user
        )

      changelog_attr = mock_attrs(:changelog)

      variables =
        changelog_attr
        |> Map.merge(%{community: community.slug, communityTags: [community_tag.id]})

      created = user_conn |> gq_mutation(Schema.m(:create_article, :changelog), variables)

      {:ok, changelog} =
        CMS.FrontDesk.article(community, :changelog, created["innerId"], preload: :community_tags)

      assert exist_in?(%{id: community_tag.id}, changelog.community_tags)
    end

    test "create changelog should escape xss attracts", ~m(user_conn community)a do
      changelog_attr = mock_attrs(:changelog, %{body: mock_xss_string()})
      variables = changelog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :changelog), variables)

      {:ok, changelog} =
        CMS.FrontDesk.article(community, :changelog, result["innerId"], preload: :document)

      body_html = changelog |> get_in([:document, :body_html])

      assert not String.contains?(body_html, "script")
    end

    test "create changelog should escape xss attracts 2", ~m(user_conn community)a do
      changelog_attr = mock_attrs(:changelog, %{body: mock_xss_string(:safe)})
      variables = changelog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :changelog), variables)

      {:ok, changelog} =
        CMS.FrontDesk.article(community, :changelog, result["innerId"], preload: :document)

      body_html = changelog |> get_in([:document, :body_html])

      assert String.contains?(body_html, "&lt;script&gt;blackmail&lt;/script&gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error
    test "create changelog with missing non_null field should get 200 error",
         ~m(user_conn community)a do
      changelog_attr = mock_attrs(:changelog)
      variables = changelog_attr |> Map.merge(%{community: community.slug}) |> Map.delete(:title)

      assert user_conn |> mutation_error?(Schema.m(:create_article, :changelog), variables)
    end

    test "delete a changelog by changelog's owner", ~m(owner_conn community changelog)a do
      variables = %{community: community.slug, id: changelog.inner_id}
      result = owner_conn |> gq_mutation(Schema.m(:delete_article, :changelog), variables)

      assert result["innerId"] == to_string(changelog.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :changelog, result["innerId"])
    end

    test "can delete a changelog by auth user", ~m(community changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      belongs_community_title = changelog.communities |> List.first() |> Map.get(:title)

      rule_conn =
        simu_conn(:user, cms: %{belongs_community_title => %{"changelog.delete" => true}})

      variables = %{community: community.slug, id: changelog.inner_id}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :changelog), variables)

      assert result["innerId"] == to_string(changelog.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :changelog, result["innerId"])
    end

    test "delete a changelog without login user fails", ~m(guest_conn community changelog)a do
      variables = %{community: community.slug, id: changelog.inner_id}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:delete_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end

    test "login user with auth passport delete a changelog", ~m(community changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      changelog_communities_0 = changelog.communities |> List.first() |> Map.get(:title)
      passport_rules = %{changelog_communities_0 => %{"changelog.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{community: community.slug, id: changelog.inner_id}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :changelog), variables)

      assert result["innerId"] == to_string(changelog.inner_id)
    end

    test "unauth user delete changelog fails", ~m(user_conn guest_conn community changelog)a do
      variables = %{community: community.slug, id: changelog.inner_id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})
      schema = Schema.m(:delete_article, :changelog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "update a changelog without login user fails", ~m(guest_conn community changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end

    test "changelog can be update by owner", ~m(owner_conn community changelog user)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs,
          user
        )

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        # body: mock_rich_text("updated body #{unique_num}"),,
        body: mock_rich_text("updated body #{unique_num}"),
        communityTags: [community_tag.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :changelog), variables)
      assert result["title"] == variables.title

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result
             |> get_in(["document", "bodyHtml"])
             |> String.contains?(~s(updated body #{unique_num}))
    end

    test "update changelog community tags should be overwrite old ones",
         ~m(owner_conn community changelog user)a do
      community_tag_attrs = mock_attrs(:community_tag)
      community_tag_attrs2 = mock_attrs(:community_tag)
      community_tag_attrs3 = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs,
          user
        )

      {:ok, community_tag2} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs2,
          user
        )

      {:ok, community_tag3} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs3,
          user
        )

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        communityTags: [community_tag.id, community_tag2.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :changelog), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        communityTags: [community_tag2.id, community_tag3.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :changelog), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag3.id)
    end

    test "update changelog with valid attrs should have is_edited meta info update",
         ~m(owner_conn community changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_changelog =
        owner_conn |> gq_mutation(Schema.m(:update_article, :changelog), variables)

      assert true == updated_changelog["meta"]["isEdited"]
    end

    test "login user with auth passport update a changelog", ~m(community changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      belongs_community_title = changelog.communities |> List.first() |> Map.get(:title)

      passport_rules = %{belongs_community_title => %{"changelog.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_changelog =
        rule_conn |> gq_mutation(Schema.m(:update_article, :changelog), variables)

      assert updated_changelog["innerId"] == to_string(changelog.inner_id)
    end

    test "unauth user update changelog fails", ~m(user_conn guest_conn community changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:update_article, :changelog),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :changelog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:update_article, :changelog),
               variables,
               ecode(:passport)
             )
    end
  end
end
