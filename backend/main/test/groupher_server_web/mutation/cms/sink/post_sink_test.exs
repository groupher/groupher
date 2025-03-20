defmodule GroupherServer.Test.Mutation.Sink.PostSink do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community post user)a}
  end

  describe "[post sink]" do
    @tag :wip2
    test "login user can sink a post", ~m(community post)a do
      variables = %{id: post.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"post.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> mutation_result(Schema.m(:sink_post), variables, "sinkPost")
      assert result["id"] == to_string(post.id)

      {:ok, post} = ORM.find(Post, post.id)
      assert post.meta.is_sinked
      assert post.active_at == post.inserted_at
    end

    @tag :wip2
    test "unauth user sink a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(Schema.m(:sink_post), variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      undoSinkPost(id: $id, communityId: $communityId) {
        id
      }
    }
    """
    @tag :wip2
    test "login user can undo sink to a post", ~m(community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"post.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.sink_article(post)
      updated = rule_conn |> mutation_result(Schema.m(:undo_sink_post), variables, "undoSinkPost")
      assert updated["id"] == to_string(post.id)

      {:ok, post} = ORM.find(Post, post.id)
      assert not post.meta.is_sinked
    end

    @tag :wip2
    test "unauth user undo sink a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_get_error?(Schema.m(:undo_sink_post), variables, ecode(:account_login))
    end
  end
end
