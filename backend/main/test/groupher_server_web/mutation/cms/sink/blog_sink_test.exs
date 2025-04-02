defmodule GroupherServer.Test.Mutation.Sink.BlogSink do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community blog user)a}
  end

  describe "[blog sink]" do
    test "login user can sink a blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"blog.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:sink_article, :blog), variables)
      assert result["innerId"] == to_string(blog.inner_id)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.meta.is_sinked
      assert blog.active_at == blog.inserted_at
    end

    test "unauth user sink a blog fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:sink_article, :blog),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo sink to a blog", ~m(community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"blog.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.sink_article(blog)

      updated = rule_conn |> gq_mutation(Schema.m(:undo_sink_article, :blog), variables)

      assert updated["innerId"] == to_string(blog.inner_id)

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert not blog.meta.is_sinked
    end

    test "unauth user undo sink a blog fails", ~m(guest_conn community blog)a do
      variables = %{id: blog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_sink_article, :blog),
               variables,
               ecode(:account_login)
             )
    end
  end
end
