defmodule GroupherServer.Test.Mutation.Flags.PostFlag do
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Post}

  alias Helper.ORM

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, post} = CMS.create_article(community, :post, mock_attrs(:post), user)
    {:ok, post2} = CMS.create_article(community, :post, mock_attrs(:post), user)
    {:ok, post3} = CMS.create_article(community, :post, mock_attrs(:post), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user post post2 post3)a}
  end

  describe "[mutation post flag curd]" do
    @query """
    mutation($id: ID!){
      markDeletePost(id: $id) {
        id
        markDelete
      }
    }
    """
    test "auth user can markDelete post", ~m(post)a do
      variables = %{id: post.id}

      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "markDeletePost")

      assert updated["id"] == to_string(post.id)
      assert updated["markDelete"] == true
    end

    test "mark delete post should update post's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, post} = CMS.create_article(community, :post, mock_attrs(:post), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 1

      variables = %{id: post.id}
      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> mutation_result(@query, variables, "markDeletePost")

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 0
    end

    test "unauth user markDelete post fails", ~m(user_conn guest_conn post)a do
      variables = %{id: post.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($id: ID!){
      undoMarkDeletePost(id: $id) {
        id
        markDelete
      }
    }
    """
    test "auth user can undo markDelete post", ~m(post)a do
      variables = %{id: post.id}

      {:ok, _} = CMS.mark_delete_article(:post, post.id)

      passport_rules = %{"post.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "undoMarkDeletePost")

      assert updated["id"] == to_string(post.id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete post should update post's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, post} = CMS.create_article(community, :post, mock_attrs(:post), user)

      {:ok, _} = CMS.mark_delete_article(:post, post.id)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 0

      variables = %{id: post.id}
      passport_rules = %{"post.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> mutation_result(@query, variables, "undoMarkDeletePost")

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.posts_count == 1
    end

    test "unauth user undo markDelete post fails", ~m(user_conn guest_conn post)a do
      variables = %{id: post.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($community: String!, $ids: [ID]!){
      batchMarkDeletePosts(community: $community, ids: $ids) {
        done
      }
    }
    """

    test "auth user can batch mark delete posts", ~m(community post post2 post3)a do
      variables = %{
        community: community.slug,
        ids: [post.inner_id, post2.inner_id]
      }

      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "batchMarkDeletePosts")

      assert updated["done"] == true

      {:ok, post} = ORM.find(Post, post.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      {:ok, post3} = ORM.find(Post, post3.id)

      assert post.mark_delete == true
      assert post2.mark_delete == true
      assert post3.mark_delete == false
    end

    @query """
    mutation($community: String!, $ids: [ID]!){
      batchUndoMarkDeletePosts(community: $community, ids: $ids) {
        done
      }
    }
    """

    test "auth user can batch undo mark delete posts", ~m(community post post2 post3)a do
      CMS.batch_mark_delete_articles(community.slug, :post, [
        post.inner_id,
        post2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [post.inner_id, post2.inner_id]
      }

      passport_rules = %{"post.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "batchUndoMarkDeletePosts")

      assert updated["done"] == true

      {:ok, post} = ORM.find(Post, post.id)
      {:ok, post2} = ORM.find(Post, post2.id)
      {:ok, post3} = ORM.find(Post, post3.id)

      assert post.mark_delete == false
      assert post2.mark_delete == false
      assert post3.mark_delete == false
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      pinPost(id: $id, communityId: $communityId) {
        id
      }
    }
    """
    test "auth user can pin post", ~m(community post)a do
      variables = %{id: post.id, communityId: community.id}

      passport_rules = %{community.slug => %{"post.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "pinPost")

      assert updated["id"] == to_string(post.id)
    end

    test "unauth user pin post fails", ~m(user_conn guest_conn community post)a do
      variables = %{id: post.id, communityId: community.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    query($community: String!, $id: ID!) {
      post(community: $community, id: $id) {
        id
        isPinned
      }
    }
    """
    test "can get pin state for article query", ~m(community user guest_conn)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
      {:ok, _} = CMS.pin_article(:post, post.id, community.id)

      variables = %{id: post.inner_id, community: community.slug}
      rule_conn = simu_conn(:user)
      ret = rule_conn |> mutation_result(@query, variables, "post")
      assert ret["isPinned"] == true

      ret = guest_conn |> mutation_result(@query, variables, "post")
      assert ret["isPinned"] == true

      {:ok, _} = CMS.undo_pin_article(:post, post.id, community.id)

      variables = %{id: post.inner_id, community: community.slug}
      rule_conn = simu_conn(:user)
      ret = rule_conn |> mutation_result(@query, variables, "post")
      assert ret["isPinned"] == false

      ret = guest_conn |> mutation_result(@query, variables, "post")
      assert ret["isPinned"] == false
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      undoPinPost(id: $id, communityId: $communityId) {
        id
        isPinned
      }
    }
    """

    test "auth user can undo pin post", ~m(community post)a do
      variables = %{id: post.id, communityId: community.id}

      passport_rules = %{community.slug => %{"post.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.pin_article(:post, post.id, community.id)
      updated = rule_conn |> mutation_result(@query, variables, "undoPinPost")

      assert updated["id"] == to_string(post.id)
    end

    test "unauth user undo pin post fails", ~m(user_conn guest_conn community post)a do
      variables = %{id: post.id, communityId: community.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end
  end
end
