defmodule GroupherServer.Test.Mutation.Sink.ChangelogSink do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.Changelog

  alias Helper.ORM

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community changelog user)a}
  end

  describe "[changelog sink]" do
    @query """
    mutation($id: ID!, $communityId: ID!){
      sinkChangelog(id: $id, communityId: $communityId) {
        id
      }
    }
    """

    test "login user can sink a changelog", ~m(community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}
      passport_rules = %{community.slug => %{"changelog.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> mutation_result(@query, variables, "sinkChangelog")
      assert result["id"] == to_string(changelog.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert changelog.meta.is_sinked
      assert changelog.active_at == changelog.inserted_at
    end

    test "unauth user sink a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      undoSinkChangelog(id: $id, communityId: $communityId) {
        id
      }
    }
    """

    test "login user can undo sink to a changelog", ~m(community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}

      passport_rules = %{community.slug => %{"changelog.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.sink_article(:changelog, changelog.id)
      updated = rule_conn |> mutation_result(@query, variables, "undoSinkChangelog")
      assert updated["id"] == to_string(changelog.id)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert not changelog.meta.is_sinked
    end

    test "unauth user undo sink a changelog fails", ~m(guest_conn community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end
  end
end
