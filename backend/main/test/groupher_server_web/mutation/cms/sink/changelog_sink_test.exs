defmodule GroupherServer.Test.Mutation.Sink.ChangelogSink do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community changelog user)a}
  end

  describe "[changelog sink]" do
    test "login user can sink a changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}
      passport_rules = %{community.slug => %{"changelog.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(Schema.m(:sink_article, :changelog), variables)

      assert result["innerId"] == to_string(changelog.inner_id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert changelog.meta.is_sunk
      assert changelog.active_at == changelog.inserted_at
    end

    test "unauth user sink a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:sink_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end

    test "login user can undo sink to a changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"changelog.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.Articles.sink(changelog)

      updated = rule_conn |> gq_mutation(Schema.m(:undo_sink_article, :changelog), variables)

      assert updated["innerId"] == to_string(changelog.inner_id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert not changelog.meta.is_sunk
    end

    test "unauth user undo sink a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_sink_article, :changelog),
               variables,
               ecode(:account_login)
             )
    end
  end
end
