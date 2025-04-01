defmodule GroupherServer.Test.Mutation.Flags.BlogFlag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, blog2} = CMS.create_article(community, :blog, mock_attrs(:blog), user)
    {:ok, blog3} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user blog blog2 blog3)a}
  end

  describe "[mutation blog flag curd]" do
    @tag :wip
    test "auth user can markDelete blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      passport_rules = %{"blog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
      assert updated["markDelete"] == true
    end

    @tag :wip
    test "mark delete blog should update blog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 1

      variables = %{id: blog.inner_id, community: community.slug}
      passport_rules = %{"blog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :blog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 0
    end

    @tag :wip
    test "unauth user markDelete blog fails",
         ~m(user_conn guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:mark_delete_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    @tag :wip
    test "auth user can undo markDelete blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      {:ok, _} = CMS.mark_delete_article(blog)

      passport_rules = %{"blog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
      assert updated["markDelete"] == false
    end

    @tag :wip
    test "undo mark delete blog should update blog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, blog} = CMS.create_article(community, :blog, mock_attrs(:blog), user)

      {:ok, _} = CMS.mark_delete_article(blog)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 0

      variables = %{id: blog.inner_id, community: community.slug}
      passport_rules = %{"blog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :blog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 1
    end

    @tag :wip
    test "unauth user undo markDelete blog fails",
         ~m(user_conn guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:undo_mark_delete_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    @tag :wip
    test "auth user can batch mark delete blogs",
         ~m(community blog blog2 blog3)a do
      variables = %{
        community: community.slug,
        ids: [blog.inner_id, blog2.inner_id]
      }

      passport_rules = %{"blog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:batch_mark_delete_article, :blog), variables)
      assert updated["done"] == true

      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)

      assert blog.mark_delete == true
      assert blog2.mark_delete == true
      assert blog3.mark_delete == false
    end

    @tag :wip
    test "auth user can batch undo mark delete blogs",
         ~m(community blog blog2 blog3)a do
      CMS.batch_mark_delete_articles(community.slug, :blog, [
        blog.inner_id,
        blog2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [blog.inner_id, blog2.inner_id]
      }

      passport_rules = %{"blog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:batch_undo_mark_delete_article, :blog), variables)

      assert updated["done"] == true

      {:ok, blog} = ORM.find(Blog, blog.id)
      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)

      assert blog.mark_delete == false
      assert blog2.mark_delete == false
      assert blog3.mark_delete == false
    end

    @tag :wip
    test "auth user can pin blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"blog.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:pin_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
    end

    @tag :wip
    test "unauth user pin blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:pin_article, :blog), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               Schema.m(:pin_article, :blog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(Schema.m(:pin_article, :blog), variables, ecode(:passport))
    end

    @tag :wip
    test "auth user can undo pin blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"blog.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.pin_article(community, blog)
      updated = rule_conn |> gq_mutation(Schema.m(:undo_pin_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
    end

    @tag :wip
    test "unauth user undo pin blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :blog),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :blog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :blog),
               variables,
               ecode(:passport)
             )
    end
  end
end
