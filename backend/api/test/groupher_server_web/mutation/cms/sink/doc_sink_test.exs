defmodule GroupherServer.Test.Mutation.Sink.DocSink do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community doc user)a}
  end

  describe "[doc sink]" do
    test "login user can sink a doc", ~m(community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}
      passport_rules = %{community.slug => %{"doc.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(S.Article.m(:sink_article, :doc), variables)
      assert result["innerId"] == to_string(doc.inner_id)

      branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)
      state = Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id)
      assert state.is_sunk
    end

    test "unauth user sink a doc fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:sink_article, :doc),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo sink to a doc", ~m(community doc user)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      passport_rules = %{community.slug => %{"doc.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)
      {:ok, _} = CMS.Articles.sink(doc.id, user, branch_id: branch.id)

      updated = rule_conn |> gq_mutation(S.Article.m(:undo_sink_article, :doc), variables)

      assert updated["innerId"] == to_string(doc.inner_id)

      state = Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id)
      refute state.is_sunk
    end

    test "unauth user undo sink a doc fails", ~m(guest_conn community doc)a do
      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}}

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_sink_article, :doc),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
