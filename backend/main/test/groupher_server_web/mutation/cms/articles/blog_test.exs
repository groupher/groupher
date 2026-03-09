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
    test "create blog with valid attrs and make sure author exist",
         ~m(user_conn user community)a do
      blog_attr = mock_attrs(:blog) |> Map.merge(%{linkAddr: "https://helloworld"})

      body = mock_rich_text("create blog by plate")

      variables = blog_attr |> Map.merge(%{community: community.slug, body: body})
      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      assert result["community"]["id"] == to_string(community.id)
      assert result["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    test "create blog with valid tags id list", ~m(user_conn user community)a do
      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)

      blog_attr = mock_attrs(:blog)

      variables =
        blog_attr |> Map.merge(%{community: community.slug, communityTags: [community_tag.id]})

      created = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        CMS.FrontDesk.article(community, :blog, created["innerId"], preload: :community_tags)

      assert exist_in?(%{id: community_tag.id}, blog.community_tags)
    end

    test "create blog should escape xss attracts", ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog, %{body: mock_xss_string()})
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        CMS.FrontDesk.article(community, :blog, result["innerId"], preload: :document)

      body_html = blog |> get_in([:document, :html])

      assert not String.contains?(body_html, "<script")
    end

    test "create blog should escape xss attracts 2", ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog, %{body: mock_xss_string(:safe)})
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      result = user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, blog} =
        CMS.FrontDesk.article(community, :blog, result["innerId"], preload: :document)

      body_html = blog |> get_in([:document, :html])

      assert String.contains?(body_html, "&amp;lt;script&amp;gt;blackmail&amp;lt;/script&amp;gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error
    test "create blog with missing non_null field should get 200 error",
         ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog)
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> Map.delete(:title)

      assert user_conn |> mutation_error?(Schema.m(:create_article, :blog), variables)
    end

    test "delete a blog by blog's owner", ~m(owner_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      result = owner_conn |> gq_mutation(Schema.m(:delete_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :blog, result["innerId"])
    end

    test "can delete a blog by auth user", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      belongs_community_slug = blog.communities |> List.first() |> Map.get(:slug)

      rule_conn =
        simu_conn(:user, cms: %{belongs_community_slug => %{"blog.delete" => true}})

      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :blog, result["innerId"])
    end

    test "delete a blog without login user fails", ~m(guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:delete_article, :blog),
               variables,
               ecode(:account_login)
             )
    end

    test "login user with auth passport delete a blog", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      blog_community_slug = blog.communities |> List.first() |> Map.get(:slug)
      passport_rules = %{blog_community_slug => %{"blog.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      result = rule_conn |> gq_mutation(Schema.m(:delete_article, :blog), variables)

      assert result["innerId"] == to_string(blog.inner_id)
    end

    test "unauth user delete blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})
      schema = Schema.m(:delete_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "update a blog without login user fails", ~m(guest_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
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

    test "blog can be update by owner", ~m(owner_conn community blog user)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}"),
        communityTags: [community_tag.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)
      assert result["title"] == variables.title

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result
             |> get_in(["document", "html"])
             |> String.contains?(~s(updated body #{unique_num}))
    end

    test "update blog community tags should be overwrite old ones",
         ~m(owner_conn community blog user)a do
      community_tag_attrs = mock_attrs(:community_tag)
      community_tag_attrs2 = mock_attrs(:community_tag)
      community_tag_attrs3 = mock_attrs(:community_tag)

      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(community, :blog, community_tag_attrs2, user)

      {:ok, community_tag3} =
        CMS.Communities.create_tag(community, :blog, community_tag_attrs3, user)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
        communityTags: [community_tag.id, community_tag2.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
        communityTags: [community_tag2.id, community_tag3.id]
      }

      result = owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert result["communityTags"] |> length == 2

      assert result["communityTags"] |> List.first() |> get_in(["id"]) ==
               to_string(community_tag2.id)

      assert result["communityTags"] |> List.last() |> get_in(["id"]) ==
               to_string(community_tag3.id)
    end

    test "update blog with valid attrs should have is_edited meta info update",
         ~m(owner_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_blog =
        owner_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert true == updated_blog["meta"]["isEdited"]
    end

    test "login user with auth passport update a blog", ~m(community blog)a do
      blog = blog |> Repo.preload(:communities)
      belongs_community_slug = blog.communities |> List.first() |> Map.get(:slug)

      passport_rules = %{belongs_community_slug => %{"blog.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_blog =
        rule_conn |> gq_mutation(Schema.m(:update_article, :blog), variables)

      assert updated_blog["innerId"] == to_string(blog.inner_id)
    end

    test "unauth user update blog fails", ~m(user_conn guest_conn community blog)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug},
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
