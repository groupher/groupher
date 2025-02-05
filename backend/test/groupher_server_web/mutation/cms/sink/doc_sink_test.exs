defmodule GroupherServer.Test.Mutation.Sink.DocSink do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.Doc

  alias Helper.ORM

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)
    {:ok, doc} = CMS.create_article(community, :doc, mock_attrs(:doc), user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community doc user)a}
  end

  describe "[doc sink]" do
    @query """
    mutation($id: ID!, $communityId: ID!){
      sinkDoc(id: $id, communityId: $communityId) {
        id
      }
    }
    """

    test "login user can sink a doc", ~m(community doc)a do
      variables = %{id: doc.id, communityId: community.id}
      passport_rules = %{community.slug => %{"doc.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> mutation_result(@query, variables, "sinkDoc")
      assert result["id"] == to_string(doc.id)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.meta.is_sinked
      assert doc.active_at == doc.inserted_at
    end

    test "unauth user sink a doc fails", ~m(guest_conn community doc)a do
      variables = %{id: doc.id, communityId: community.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    @query """
    mutation($id: ID!, $communityId: ID!){
      undoSinkDoc(id: $id, communityId: $communityId) {
        id
      }
    }
    """

    test "login user can undo sink to a doc", ~m(community doc)a do
      variables = %{id: doc.id, communityId: community.id}

      passport_rules = %{community.slug => %{"doc.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.sink_article(:doc, doc.id)
      updated = rule_conn |> mutation_result(@query, variables, "undoSinkDoc")
      assert updated["id"] == to_string(doc.id)

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert not doc.meta.is_sinked
    end

    test "unauth user undo sink a doc fails", ~m(guest_conn community doc)a do
      variables = %{id: doc.id, communityId: community.id}

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end
  end
end
