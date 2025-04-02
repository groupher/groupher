defmodule GroupherServer.Test.Mutation.Flags.ChangelogFlag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, changelog2} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)
    {:ok, changelog3} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user changelog changelog2 changelog3)a}
  end

  describe "[mutation changelog flag curd]" do
    test "auth user can markDelete changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :changelog), variables)

      assert updated["innerId"] == to_string(changelog.inner_id)
      assert updated["markDelete"] == true
    end

    test "mark delete changelog should update changelog's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 1

      variables = %{id: changelog.inner_id, community: community.slug}
      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :changelog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 0
    end

    test "unauth user markDelete changelog fails",
         ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:mark_delete_article, :changelog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can undo markDelete changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      {:ok, _} = CMS.mark_delete_article(changelog)

      passport_rules = %{"changelog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :changelog), variables)

      assert updated["innerId"] == to_string(changelog.inner_id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete changelog should update changelog's communities meta count",
         ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, changelog} = CMS.create_article(community, :changelog, mock_attrs(:changelog), user)

      {:ok, _} = CMS.mark_delete_article(changelog)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 0

      variables = %{id: changelog.inner_id, community: community.slug}
      passport_rules = %{"changelog.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :changelog), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.changelogs_count == 1
    end

    test "unauth user undo markDelete changelog fails",
         ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:undo_mark_delete_article, :changelog)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can batch mark delete changelogs",
         ~m(community changelog changelog2 changelog3)a do
      variables = %{
        community: community.slug,
        ids: [changelog.inner_id, changelog2.inner_id]
      }

      passport_rules = %{"changelog.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:batch_mark_delete_article, :changelog), variables)

      assert updated["done"] == true

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog.mark_delete == true
      assert changelog2.mark_delete == true
      assert changelog3.mark_delete == false
    end

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

      updated =
        rule_conn |> gq_mutation(Schema.m(:batch_undo_mark_delete_article, :changelog), variables)

      assert updated["done"] == true

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog.mark_delete == false
      assert changelog2.mark_delete == false
      assert changelog3.mark_delete == false
    end

    test "auth user can pin changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"changelog.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:pin_article, :changelog), variables)

      assert updated["innerId"] == to_string(changelog.inner_id)
    end

    test "unauth user pin changelog fails", ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:pin_article, :changelog), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               Schema.m(:pin_article, :changelog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(Schema.m(:pin_article, :changelog), variables, ecode(:passport))
    end

    test "auth user can undo pin changelog", ~m(community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"changelog.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.pin_article(community, changelog)
      updated = rule_conn |> gq_mutation(Schema.m(:undo_pin_article, :changelog), variables)

      assert updated["innerId"] == to_string(changelog.inner_id)
    end

    test "unauth user undo pin changelog fails", ~m(user_conn guest_conn community changelog)a do
      variables = %{id: changelog.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :changelog),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :changelog),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :changelog),
               variables,
               ecode(:passport)
             )
    end
  end
end
