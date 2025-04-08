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
    test "login user can sink a post", ~m(community post)a do
      variables = %{id: post.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"post.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:sink_article, :post), variables)
      assert result["innerId"] == to_string(post.inner_id)

      {:ok, post} = ORM.find(Post, post.id)
      assert post.meta.is_sunk
      assert post.active_at == post.inserted_at
    end

    test "unauth user sink a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:sink_article, :post),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo sink to a post", ~m(community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"post.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.sink_article(post)

      updated = rule_conn |> gq_mutation(Schema.m(:undo_sink_article, :post), variables)
      assert updated["innerId"] == to_string(post.inner_id)

      {:ok, post} = ORM.find(Post, post.id)
      assert not post.meta.is_sunk
    end

    test "unauth user undo sink a post fails", ~m(guest_conn community post)a do
      variables = %{id: post.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_sink_article, :post),
               variables,
               ecode(:account_login)
             )
    end
  end
end
