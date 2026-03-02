defmodule GroupherServer.Test.Mutation.Flags.PostFlag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, post2} = CMS.Articles.create(community, :post, mock_attrs(:post), user)
    {:ok, post3} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user post post2 post3)a}
  end

  describe "[mutation post flag curd]" do
    test "auth user can markDelete post", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
      assert updated["markDelete"] == true
    end

    test "mark delete post should update post's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 1

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :post), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 0
    end

    test "unauth user markDelete post fails",
         ~m(user_conn guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:mark_delete_article, :post)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can undo markDelete post", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      {:ok, _} = CMS.Articles.mark_delete(post)

      passport_rules = %{"post.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete post should update post's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, post} = CMS.Articles.create(community, :post, mock_attrs(:post), user)

      {:ok, _} = CMS.Articles.mark_delete(post)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 0

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      passport_rules = %{"post.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :post), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 1
    end

    test "unauth user undo markDelete post fails",
         ~m(user_conn guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:undo_mark_delete_article, :post)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can batch mark delete posts",
         ~m(community post post2 post3)a do
      variables = %{
        community: community.slug,
        ids: [post.inner_id, post2.inner_id]
      }

      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:batch_mark_delete_article, :post), variables)
      assert updated["done"] == true

      {:ok, post} = ORM.find(Post, post.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      {:ok, post3} = ORM.find(Post, post3.id)

      assert post.mark_delete == true
      assert post2.mark_delete == true
      assert post3.mark_delete == false
    end

    test "auth user can batch undo mark delete posts",
         ~m(community post post2 post3)a do
      CMS.Articles.batch_mark_delete(community.slug, :post, [
        post.inner_id,
        post2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [post.inner_id, post2.inner_id]
      }

      passport_rules = %{"post.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:batch_undo_mark_delete_article, :post), variables)

      assert updated["done"] == true

      {:ok, post} = ORM.find(Post, post.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      {:ok, post3} = ORM.find(Post, post3.id)

      assert post.mark_delete == false
      assert post2.mark_delete == false
      assert post3.mark_delete == false
    end

    test "auth user can pin post", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      passport_rules = %{community.slug => %{"post.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:pin_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
    end

    test "unauth user pin post fails", ~m(user_conn guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:pin_article, :post), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               Schema.m(:pin_article, :post),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(Schema.m(:pin_article, :post), variables, ecode(:passport))
    end

    test "auth user can undo pin post", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      passport_rules = %{community.slug => %{"post.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.Articles.pin(community, post)
      updated = rule_conn |> gq_mutation(Schema.m(:undo_pin_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
    end

    test "unauth user undo pin post fails", ~m(user_conn guest_conn community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :post),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :post),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :post),
               variables,
               ecode(:passport)
             )
    end
  end
end
