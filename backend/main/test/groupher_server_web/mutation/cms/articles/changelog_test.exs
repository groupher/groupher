defmodule GroupherServer.Test.Mutation.Articles.Changelog do
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Changelog, Author}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
    {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    {:ok, ~m(user_conn guest_conn owner_conn user community changelog)a}
  end

  describe "[mutation changelog curd]" do
    @create_changelog_query """
    mutation(
      $title: String!
      $body: String!
      $communityId: ID!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      createChangelog(
        title: $title
        body: $body
        communityId: $communityId
        articleTags: $articleTags
        linkAddr: $linkAddr
      ) {
        id
        title
        linkAddr
        document {
          bodyHtml
        }
        originalCommunity {
          id
        }
      }
    }
    """

    test "create changelog with valid attrs and make sure author exsit" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)
      changelog_attr = mock_attrs(:changelog) |> Map.merge(%{linkAddr: "https://helloworld"})

      # body = """
      # {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 \"red chevron\"。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      # """
      body = """
      {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 red chevron。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      """

      variables = changelog_attr |> Map.merge(%{communityId: community.id, body: body})

      created =
        user_conn |> mutation_result(@create_changelog_query, variables, "createChangelog")

      {:ok, changelog} = ORM.find(Changelog, created["id"])

      assert created["id"] == to_string(changelog.id)
      assert created["originalCommunity"]["id"] == to_string(community.id)
      assert created["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    test "create changelog with valid tags id list", ~m(user_conn user community)a do
      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)

      changelog_attr = mock_attrs(:changelog)

      variables =
        changelog_attr |> Map.merge(%{communityId: community.id, articleTags: [article_tag.id]})

      created =
        user_conn |> mutation_result(@create_changelog_query, variables, "createChangelog")

      {:ok, changelog} = ORM.find(Changelog, created["id"], preload: :article_tags)

      assert exist_in?(%{id: article_tag.id}, changelog.article_tags)
    end

    test "create changelog should excape xss attracts" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)

      changelog_attr = mock_attrs(:changelog, %{body: mock_xss_string()})
      variables = changelog_attr |> Map.merge(%{communityId: community.id}) |> camelize_map_key
      result = user_conn |> mutation_result(@create_changelog_query, variables, "createChangelog")
      {:ok, changelog} = ORM.find(Changelog, result["id"], preload: :document)
      body_html = changelog |> get_in([:document, :body_html])

      assert not String.contains?(body_html, "script")
    end

    test "create changelog should excape xss attracts 2" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)

      changelog_attr = mock_attrs(:changelog, %{body: mock_xss_string(:safe)})
      variables = changelog_attr |> Map.merge(%{communityId: community.id}) |> camelize_map_key
      result = user_conn |> mutation_result(@create_changelog_query, variables, "createChangelog")
      {:ok, changelog} = ORM.find(Changelog, result["id"], preload: :document)
      body_html = changelog |> get_in([:document, :body_html])

      assert String.contains?(body_html, "&lt;script&gt;blackmail&lt;/script&gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error

    test "create changelog with missing non_null field should get 200 error" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)
      changelog_attr = mock_attrs(:changelog)
      variables = changelog_attr |> Map.merge(%{communityId: community.id}) |> Map.delete(:title)

      assert user_conn |> mutation_get_error?(@create_changelog_query, variables)
    end

    @query """
    mutation($id: ID!){
      deleteChangelog(id: $id) {
        id
      }
    }
    """

    test "delete a changelog by changelog's owner", ~m(owner_conn changelog)a do
      deleted = owner_conn |> mutation_result(@query, %{id: changelog.id}, "deleteChangelog")

      assert deleted["id"] == to_string(changelog.id)
      assert {:error, _} = ORM.find(Changelog, deleted["id"])
    end

    test "can delete a changelog by auth user", ~m(changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      belongs_community_title = changelog.communities |> List.first() |> Map.get(:title)

      rule_conn =
        simu_conn(:user, cms: %{belongs_community_title => %{"changelog.delete" => true}})

      deleted = rule_conn |> mutation_result(@query, %{id: changelog.id}, "deleteChangelog")

      assert deleted["id"] == to_string(changelog.id)
      assert {:error, _} = ORM.find(Changelog, deleted["id"])
    end

    test "delete a changelog without login user fails", ~m(guest_conn changelog)a do
      assert guest_conn |> mutation_get_error?(@query, %{id: changelog.id}, ecode(:account_login))
    end

    test "login user with auth passport delete a changelog", ~m(changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      changelog_communities_0 = changelog.communities |> List.first() |> Map.get(:title)
      passport_rules = %{changelog_communities_0 => %{"changelog.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      # assert conn |> mutation_get_error?(@query, %{id: changelog.id})

      deleted = rule_conn |> mutation_result(@query, %{id: changelog.id}, "deleteChangelog")

      assert deleted["id"] == to_string(changelog.id)
    end

    test "unauth user delete changelog fails", ~m(user_conn guest_conn changelog)a do
      variables = %{id: changelog.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($id: ID!, $title: String, $body: String, $articleTags: [ID]){
      updateChangelog(id: $id, title: $title, body: $body, articleTags: $articleTags) {
        id
        title
        document {
          bodyHtml
        }
        meta {
          isEdited
        }
        commentsParticipants {
          id
          nickname
        }
        articleTags {
          id
        }
      }
    }
    """

    test "update a changelog without login user fails", ~m(guest_conn changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    test "changelog can be update by owner", ~m(owner_conn changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.id,
        title: "updated title #{unique_num}",
        # body: mock_rich_text("updated body #{unique_num}"),,
        body: mock_rich_text("updated body #{unique_num}")
      }

      result = owner_conn |> mutation_result(@query, variables, "updateChangelog")
      assert result["title"] == variables.title

      assert result
             |> get_in(["document", "bodyHtml"])
             |> String.contains?(~s(updated body #{unique_num}))

      assert result["title"] == variables.title
    end

    test "update changelog with valid attrs should have is_edited meta info update",
         ~m(owner_conn changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_changelog = owner_conn |> mutation_result(@query, variables, "updateChangelog")

      assert true == updated_changelog["meta"]["isEdited"]
    end

    test "login user with auth passport update a changelog", ~m(changelog)a do
      changelog = changelog |> Repo.preload(:communities)
      belongs_community_title = changelog.communities |> List.first() |> Map.get(:title)

      passport_rules = %{belongs_community_title => %{"changelog.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      # assert conn |> mutation_get_error?(@query, %{id: changelog.id})
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_changelog = rule_conn |> mutation_result(@query, variables, "updateChangelog")

      assert updated_changelog["id"] == to_string(changelog.id)
    end

    test "unauth user update changelog fails", ~m(user_conn guest_conn changelog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: changelog.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end
  end
end
