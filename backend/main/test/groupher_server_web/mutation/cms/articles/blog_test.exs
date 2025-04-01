defmodule GroupherServer.Test.Mutation.Articles.Blog do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, blog)

    {:ok, ~m(user_conn guest_conn owner_conn user community blog)a}
  end

  describe "[mutation blog curd]" do
    @tag :wip
    test "create blog with valid attrs and make sure author exist",
         ~m(user_conn user community)a do
      blog_attr = mock_attrs(:blog) |> Map.merge(%{linkAddr: "https://helloworld"})

      body = """
      {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 red chevron。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      """

      variables = blog_attr |> Map.merge(%{community: community.slug, body: body})
      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} = ORM.find_article(community, :blog, result["innerId"])

      assert result["innerId"] == to_string(blog.inner_id)
      assert result["originalCommunity"]["id"] == to_string(community.id)
      assert result["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    @tag :wip
    test "create blog with valid tags id list", ~m(user_conn user community)a do
      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      blog_attr = mock_attrs(:blog)

      variables =
        blog_attr |> Map.merge(%{community: community.slug, articleTags: [article_tag.id]})

      created = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        ORM.find_article(community, :blog, created["innerId"], preload: :article_tags)

      assert exist_in?(%{id: article_tag.id}, blog.article_tags)
    end

    @tag :wip
    test "create blog should escape xss attracts", ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog, %{body: mock_xss_string()})
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        ORM.find_article(community, :blog, result["innerId"], preload: :document)

      body_html = blog |> get_in([:document, :body_html])

      assert not String.contains?(body_html, "script")
    end

    @tag :wip
    test "create blog should escape xss attracts 2", ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog, %{body: mock_xss_string(:safe)})
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        ORM.find_article(community, :blog, result["innerId"], preload: :document)

      body_html = blog |> get_in([:document, :body_html])

      assert String.contains?(body_html, "&lt;script&gt;blackmail&lt;/script&gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error
    @tag :wip
    test "create blog with missing non_null field should get 200 error",
         ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog)
      variables = blog_attr |> Map.merge(%{communityId: community.id}) |> Map.delete(:title)

      assert user_conn |> mutation_error?(Schema.m(:create_article, :blog), variables)
    end

    @tag :wip
    test "delete a blog by blog's owner", ~m(owner_conn community blog)a do
      variables = %{community: community.slug, id: blog.inner_id}
      result = owner_conn |> gq_mutation(Schema.m(:delate_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
      assert {:error, _} = ORM.find_article(community, :blog, result["innerId"])
    end

    @tag :wip
    test "can delete a blog by auth user", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      belongs_community_title = blog.communities |> List.first() |> Map.get(:title)

      rule_conn =
        simu_conn(:user, cms: %{belongs_community_title => %{"blog.delete" => true}})

      variables = %{community: community.slug, id: blog.inner_id}
      result = rule_conn |> gq_mutation(Schema.m(:delate_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
      assert {:error, _} = ORM.find_article(community, :blog, result["innerId"])
    end

    @tag :wip
    test "delete a blog without login user fails", ~m(guest_conn community blog)a do
      variables = %{community: community.slug, id: blog.inner_id}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:delate_article, :blog),
               variables,
               ecode(:account_login)
             )
    end

    @tag :wip
    test "login user with auth passport delete a blog", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      blog_communities_0 = blog.communities |> List.first() |> Map.get(:title)
      passport_rules = %{blog_communities_0 => %{"blog.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{community: community.slug, id: blog.inner_id}
      result = rule_conn |> gq_mutation(Schema.m(:delate_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
    end

    @tag :wip
    test "unauth user delete blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{community: community.slug, id: blog.inner_id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})
      schema = Schema.m(:delate_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    @tag :wip
    test "update a blog without login user fails", ~m(guest_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :blog),
               variables,
               ecode(:account_login)
             )
    end

    @tag :wip
    test "blog can be update by owner", ~m(owner_conn community blog user)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        # body: mock_rich_text("updated body #{unique_num}"),,
        body: mock_rich_text("updated body #{unique_num}"),
        articleTags: [article_tag.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)
      assert result["title"] == variables.title

      assert result["articleTags"] |> List.first() |> get_in(["id"]) == to_string(article_tag.id)

      assert result
             |> get_in(["document", "bodyHtml"])
             |> String.contains?(~s(updated body #{unique_num}))
    end

    @tag :wip
    test "update blog article tags should be overwrite old ones",
         ~m(owner_conn community blog user)a do
      article_tag_attrs = mock_attrs(:article_tag)
      article_tag_attrs2 = mock_attrs(:article_tag)
      article_tag_attrs3 = mock_attrs(:article_tag)

      {:ok, article_tag} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      {:ok, article_tag2} =
        CMS.create_article_tag(community, :blog, article_tag_attrs2, user)

      {:ok, article_tag3} =
        CMS.create_article_tag(community, :blog, article_tag_attrs3, user)

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        articleTags: [article_tag.id, article_tag2.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert result["articleTags"] |> length == 2
      assert result["articleTags"] |> List.first() |> get_in(["id"]) == to_string(article_tag.id)
      assert result["articleTags"] |> List.last() |> get_in(["id"]) == to_string(article_tag2.id)

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        articleTags: [article_tag2.id, article_tag3.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert result["articleTags"] |> length == 2
      assert result["articleTags"] |> List.first() |> get_in(["id"]) == to_string(article_tag2.id)
      assert result["articleTags"] |> List.last() |> get_in(["id"]) == to_string(article_tag3.id)
    end

    @tag :wip
    test "update blog with valid attrs should have is_edited meta info update",
         ~m(owner_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_blog =
        owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert true == updated_blog["meta"]["isEdited"]
    end

    @tag :wip
    test "login user with auth passport update a blog", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      belongs_community_title = blog.communities |> List.first() |> Map.get(:title)

      passport_rules = %{belongs_community_title => %{"blog.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_blog =
        rule_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert updated_blog["innerId"] == to_string(blog.inner_id)
    end

    @tag :wip
    test "unauth user update blog fails", ~m(user_conn guest_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: blog.inner_id,
        community: community.slug,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:update_article, :blog),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:update_article, :blog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:update_article, :blog),
               variables,
               ecode(:passport)
             )
    end
  end
end
