defmodule GroupherServer.Test.Mutation.Flags.DocFlag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc)

    {:ok, doc2} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)
    {:ok, doc3} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn owner_conn community user doc doc2 doc3)a}
  end

  describe "[mutation doc flag curd]" do
    test "auth user can markDelete doc", ~m(community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      passport_rules = %{"doc.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :doc), variables)

      assert updated["innerId"] == to_string(doc.inner_id)
      assert updated["markDelete"] == true
    end

    test "mark delete doc should update doc's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.docs_count == 1

      variables = %{id: doc.inner_id, community: community.slug}
      passport_rules = %{"doc.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :doc), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.docs_count == 0
    end

    test "unauth user markDelete doc fails",
         ~m(user_conn guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:mark_delete_article, :doc)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can undo markDelete doc", ~m(community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      {:ok, _} = CMS.Articles.mark_delete(doc)

      passport_rules = %{"doc.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :doc), variables)

      assert updated["innerId"] == to_string(doc.inner_id)
      assert updated["markDelete"] == false
    end

    test "undo mark delete doc should update doc's communities meta count", ~m(user)a do
      community_attrs = mock_attrs(:community)
      {:ok, community} = CMS.create_community(community_attrs, user)
      {:ok, doc} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)

      {:ok, _} = CMS.Articles.mark_delete(doc)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.docs_count == 0

      variables = %{id: doc.inner_id, community: community.slug}
      passport_rules = %{"doc.undo_mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)
      rule_conn |> gq_mutation(Schema.m(:undo_mark_delete_article, :doc), variables)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.meta.docs_count == 1
    end

    test "unauth user undo markDelete doc fails",
         ~m(user_conn guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      schema = Schema.m(:undo_mark_delete_article, :doc)

      assert user_conn |> mutation_error?(schema, variables, ecode(:passport))
      assert guest_conn |> mutation_error?(schema, variables, ecode(:account_login))
      assert rule_conn |> mutation_error?(schema, variables, ecode(:passport))
    end

    test "auth user can batch mark delete docs",
         ~m(community doc doc2 doc3)a do
      variables = %{
        community: community.slug,
        ids: [doc.inner_id, doc2.inner_id]
      }

      passport_rules = %{"doc.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:batch_mark_delete_article, :doc), variables)
      assert updated["done"] == true

      {:ok, doc} = ORM.find(Doc, doc.id)
      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)

      assert doc.mark_delete == true
      assert doc2.mark_delete == true
      assert doc3.mark_delete == false
    end

    test "auth user can batch undo mark delete docs",
         ~m(community doc doc2 doc3)a do
      CMS.Articles.batch_mark_delete(community.slug, :doc, [
        doc.inner_id,
        doc2.inner_id
      ])

      variables = %{
        community: community.slug,
        ids: [doc.inner_id, doc2.inner_id]
      }

      passport_rules = %{"doc.mark_delete" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated =
        rule_conn |> gq_mutation(Schema.m(:batch_undo_mark_delete_article, :doc), variables)

      assert updated["done"] == true

      {:ok, doc} = ORM.find(Doc, doc.id)
      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)

      assert doc.mark_delete == false
      assert doc2.mark_delete == false
      assert doc3.mark_delete == false
    end

    test "auth user can pin doc", ~m(community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"doc.pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:pin_article, :doc), variables)

      assert updated["innerId"] == to_string(doc.inner_id)
    end

    test "unauth user pin doc fails", ~m(user_conn guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:pin_article, :doc), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(
               Schema.m(:pin_article, :doc),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(Schema.m(:pin_article, :doc), variables, ecode(:passport))
    end

    test "auth user can undo pin doc", ~m(community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}

      passport_rules = %{community.slug => %{"doc.undo_pin" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      CMS.Articles.pin(community, doc)
      updated = rule_conn |> gq_mutation(Schema.m(:undo_pin_article, :doc), variables)

      assert updated["innerId"] == to_string(doc.inner_id)
    end

    test "unauth user undo pin doc fails", ~m(user_conn guest_conn community doc)a do
      variables = %{id: doc.inner_id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :doc),
               variables,
               ecode(:passport)
             )

      assert guest_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :doc),
               variables,
               ecode(:account_login)
             )

      assert rule_conn
             |> mutation_error?(
               Schema.m(:undo_pin_article, :doc),
               variables,
               ecode(:passport)
             )
    end
  end
end
