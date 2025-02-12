defmodule GroupherServer.Test.Mutation.Flags.ChangelogFlag do
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Changelog}

  alias Helper.ORM

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
    {:ok, changelog2} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
    {:ok, changelog3} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user changelog changelog2 changelog3)a}
  end

  describe "[mutation changelog flag curd]" do
    @query """
    mutation($id: ID!){
      markDeleteChangelog(id: $id) {
        id
        markDelete
      }
    }
    """

    test "auth user can markDelete changelog", ~m(changelog)a do
      variables = %{id: changelog.id}

      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "markDeleteChangelog")

      assert updated["id"] == to_string(changelog.id)
      assert updated["markDelete"] == true
    end

    test "mark delete changelog should update changelog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 1

      variables = %{id: changelog.id}
      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> mutation_result(@query, variables, "markDeleteChangelog")

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 0
    end

    test "unauth user markDelete changelog fails", ~m(user_conn guest_conn changelog)a do
      variables = %{id: changelog.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($id: ID!){
      undoMarkDeleteChangelog(id: $id) {
        id
        markDelete
      }
    }
    """

    test "auth user can undo markDelete changelog", ~m(changelog)a do
      variables = %{id: changelog.id}

      {:ok, _} = CMS.mark_delete_article(:changelog, changelog.id)

      passport_rules = %{"changelog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "undoMarkDeleteChangelog")

      assert updated["id"] == to_string(changelog.id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete changelog should update changelog's communities meta count",
         ~m(user)a do
      community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
      {:ok, community} = CMS.create_community(community_attrs)
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:ok, _} = CMS.mark_delete_article(:changelog, changelog.id)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 0

      variables = %{id: changelog.id}
      passport_rules = %{"changelog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> mutation_result(@query, variables, "undoMarkDeleteChangelog")

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 1
    end

    test "unauth user undo markDelete changelog fails", ~m(user_conn guest_conn changelog)a do
      variables = %{id: changelog.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($community: String!, $ids: [ID]!){
      batchMarkDeleteChangelogs(community: $community, ids: $ids) {
        done
      }
    }
    """

    test "auth user can batch mark delete changelogs",
         ~m(community changelog changelog2 changelog3)a do
      variables = %{
        community: community.slug,
        ids: [changelog.inner_id, changelog2.inner_id]
      }

      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "batchMarkDeleteChangelogs")

      assert updated["done"] == true

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog.mark_delete == true
      assert changelog2.mark_delete == true
      assert changelog3.mark_delete == false
    end

    @query """
    mutation($community: String!, $ids: [ID]!){
      batchUndoMarkDeleteChangelogs(community: $community, ids: $ids) {
        done
      }
    }
    """

    test "auth user can batch undo mark delete changelogs",
         ~m(community changelog changelog2 changelog3)a do
      CMS.batch_mark_delete_articles(community.slug, :changelog, [
        changelog.inner_id,
        changelog2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [changelog.inner_id, changelog2.inner_id]
      }

      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "batchUndoMarkDeleteChangelogs")

      assert updated["done"] == true

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog.mark_delete == false
      assert changelog2.mark_delete == false
      assert changelog3.mark_delete == false
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      pinChangelog(id: $id, communityId: $communityId) {
        id
      }
    }
    """

    test "auth user can pin changelog", ~m(community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}

      passport_rules = %{community.slug => %{"changelog.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@query, variables, "pinChangelog")

      assert updated["id"] == to_string(changelog.id)
    end

    test "unauth user pin changelog fails", ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      undoPinChangelog(id: $id, communityId: $communityId) {
        id
        isPinned
      }
    }
    """

    test "auth user can undo pin changelog", ~m(community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}

      passport_rules = %{community.slug => %{"changelog.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.pin_article(:changelog, changelog.id, community.id)
      updated = rule_conn |> mutation_result(@query, variables, "undoPinChangelog")

      assert updated["id"] == to_string(changelog.id)
    end

    test "unauth user undo pin changelog fails", ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.id, communityId: community.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end
  end
end
