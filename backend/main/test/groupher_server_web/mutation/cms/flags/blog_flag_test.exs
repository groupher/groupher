defmodule GroupherServer.Test.Mutation.Flags.BlogFlag do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, blog2} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)
    {:ok, blog3} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user blog blog2 blog3)a}
  end

  describe "[mutation blog flag curd]" do
    test "auth user can markDelete blog", ~m(community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}

      passport_rules = %{community.slug => %{"blog.mark_delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
      assert updated["markDelete"] == true
    end

    test "mark delete blog should update blog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 1

      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      passport_rules = %{community.slug => %{"blog.mark_delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :blog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 0
    end

    test "unauth user markDelete blog fails",
         ~m(user_conn guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:mark_delete_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can undo markDelete blog", ~m(community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}

      {:ok, _} = CMS.Articles.mark_delete(blog)

      passport_rules = %{community.slug => %{"blog.undo_mark_delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete blog should update blog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, blog} = CMS.Articles.create(community, :blog, mock_attrs(:blog), user)

      {:ok, _} = CMS.Articles.mark_delete(blog)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 0

      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      passport_rules = %{community.slug => %{"blog.undo_mark_delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :blog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.blogs_count == 1
    end

    test "unauth user undo markDelete blog fails",
         ~m(user_conn guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:undo_mark_delete_article, :blog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can batch mark delete blogs",
         ~m(community blog blog2 blog3)a do
      variables = %{
        community: community.slug,
        ids: [blog.inner_id, blog2.inner_id]
      }

      passport_rules = %{community.slug => %{"blog.mark_delete" => true}}
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

    test "auth user can batch undo mark delete blogs",
         ~m(community blog blog2 blog3)a do
      CMS.Articles.batch_mark_delete(community.slug, :blog, [
        blog.inner_id,
        blog2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [blog.inner_id, blog2.inner_id]
      }

      passport_rules = %{community.slug => %{"blog.undo_mark_delete" => true}}
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

    test "auth user can pin blog", ~m(community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}

      passport_rules = %{community.slug => %{"blog.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:pin_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
    end

    test "unauth user pin blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
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

    test "auth user can undo pin blog", ~m(community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}

      passport_rules = %{community.slug => %{"blog.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.Articles.pin(community, blog)
      updated = rule_conn |> gq_mutation(Schema.m(:undo_pin_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)
    end

    test "unauth user undo pin blog fails", ~m(user_conn guest_conn community blog)a do
      variables = %{article: %{inner_id: blog.inner_id, community: community.slug}}
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
