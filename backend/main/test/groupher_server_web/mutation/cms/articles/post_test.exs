defmodule GroupherServer.Test.Mutation.Articles.Post do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(user_conn guest_conn owner_conn user community post)a}
  end

  describe "[mutation post curd]" do
    test "create post with valid attrs and make sure author exist",
         ~m(user_conn user community)a do
      post_attr = mock_attrs(:post) |> Map.merge(%{linkAddr: "https://helloworld"})

      body = """
      {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 red chevron。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      """

      variables = post_attr |> Map.merge(%{community: community.slug, body: body})
      result = user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, post} = CMS.FrontDesk.article(community, :post, result["innerId"])

      assert result["innerId"] == to_string(post.inner_id)
      assert result["community"]["id"] == to_string(community.id)
      assert result["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    test "create post with valid tags id list", ~m(user_conn user community)a do
      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      post_attr = mock_attrs(:post)

      variables =
        post_attr |> Map.merge(%{community: community.slug, communityTags: [community_tag.id]})

      created = user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, post} =
        CMS.FrontDesk.article(community, :post, created["innerId"], preload: :community_tags)

      assert exist_in?(%{id: community_tag.id}, post.community_tags)
    end

    test "create post should escape xss attracts", ~m(user_conn community)a do
      post_attr = mock_attrs(:post, %{body: mock_xss_string()})
      variables = post_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, post} = CMS.FrontDesk.article(community, :post, result["innerId"], preload: :document)
      body_html = post |> get_in([:document, :body_html])

      assert not String.contains?(body_html, "script")
    end

    test "create post should escape xss attracts 2", ~m(user_conn community)a do
      post_attr = mock_attrs(:post, %{body: mock_xss_string(:safe)})
      variables = post_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, post} = CMS.FrontDesk.article(community, :post, result["innerId"], preload: :document)
      body_html = post |> get_in([:document, :body_html])

      assert String.contains?(body_html, "&lt;script&gt;blackmail&lt;/script&gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error
    test "create post with missing non_null field should get 200 error",
         ~m(user_conn community)a do
      post_attr = mock_attrs(:post)
      variables = post_attr |> Map.merge(%{community: community.slug}) |> Map.delete(:title)

      assert user_conn |> mutation_error?(Schema.m(:create_article, :post), variables)
    end

    test "delete a post by post's owner", ~m(owner_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      result = owner_conn |> gq_mutation(Schema.m(:delete_article, :post), variables)

      assert result["innerId"] == to_string(post.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :post, result["innerId"])
    end

    test "can delete a post by auth user", ~m(community post)a do
      post = post |> Repo.preload(:communities)
      belongs_community_slug = post.communities |> List.first() |> Map.get(:slug)
      rule_conn = simu_conn(:user, cms: %{belongs_community_slug => %{"post.delete" => true}})

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :post), variables)

      assert result["innerId"] == to_string(post.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :post, result["innerId"])
    end

    test "delete a post without login user fails", ~m(guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:delete_article, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "login user with auth passport delete a post", ~m(community post)a do
      post = post |> Repo.preload(:communities)
      post_community_slug = post.communities |> List.first() |> Map.get(:slug)
      passport_rules = %{post_community_slug => %{"post.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :post), variables)

      assert result["innerId"] == to_string(post.inner_id)
    end

    test "unauth user delete post fails", ~m(user_conn guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})
      schema = Schema.m(:delete_article, :post)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "update a post without login user fails", ~m(guest_conn community post)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "post can be update by owner", ~m(owner_conn community post user)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}"),
        copyRight: "translate",
        communityTags: [community_tag.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :post), variables)
      assert result["title"] == variables.title

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result
             |> get_in(["document", "bodyHtml"])
             |> String.contains?(~s(updated body #{unique_num}))

      assert result["copyRight"] == variables.copyRight
    end

    test "update post community tags should be overwrite old ones",
         ~m(owner_conn community post user)a do
      community_tag_attrs = mock_attrs(:community_tag)
      community_tag_attrs2 = mock_attrs(:community_tag)
      community_tag_attrs3 = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs2, user)

      {:ok, community_tag3} =
        CMS.Communities.create_tag(community, :post, community_tag_attrs3, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        communityTags: [community_tag.id, community_tag2.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :post), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        communityTags: [community_tag2.id, community_tag3.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :post), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag3.id)
    end

    test "update post with valid attrs should have is_edited meta info update",
         ~m(owner_conn community post)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_post = owner_conn |> gq_mutation(Schema.m(:update_article, :post), variables)

      assert true == updated_post["meta"]["isEdited"]
    end

    test "login user with auth passport update a post", ~m(community post)a do
      post = post |> Repo.preload(:communities)
      belongs_community_slug = post.communities |> List.first() |> Map.get(:slug)

      passport_rules = %{belongs_community_slug => %{"post.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_post = rule_conn |> gq_mutation(Schema.m(:update_article, :post), variables)

      assert updated_post["innerId"] == to_string(post.inner_id)
    end

    test "unauth user update post fails", ~m(user_conn guest_conn community post)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:update_article, :post), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :post),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(Schema.m(:update_article, :post), variables, ecode(:passport))
    end

    test "user with A community rule cannot update B community post", ~m(user)a do
      {:ok, community_a} = mock_community(user)
      {:ok, community_b} = mock_community(user)
      {:ok, post_b} = CMS.Articles.create(community_b, :post, mock_attrs(:post), user)

      passport_rules = %{community_a.slug => %{"post.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: post_b.inner_id, community: community_b.slug},
        title: "cross-community-update-#{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert rule_conn
             |> mutation_error?(Schema.m(:update_article, :post), variables, ecode(:passport))

      {:ok, found} = CMS.FrontDesk.article(community_b, :post, post_b.inner_id)
      refute found.title == "cross-community-update-#{unique_num}"
    end

    test "user with A community rule cannot delete B community post", ~m(user)a do
      {:ok, community_a} = mock_community(user)
      {:ok, community_b} = mock_community(user)
      {:ok, post_b} = CMS.Articles.create(community_b, :post, mock_attrs(:post), user)

      passport_rules = %{community_a.slug => %{"post.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: post_b.inner_id, community: community_b.slug}}

      assert rule_conn
             |> mutation_error?(Schema.m(:delete_article, :post), variables, ecode(:passport))

      assert {:ok, _} = CMS.FrontDesk.article(community_b, :post, post_b.inner_id)
    end
  end
end
