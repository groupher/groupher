defmodule GroupherServer.Test.CMS.DocTree.Revision do
  @moduledoc false

  use GroupherServer.TestMate

  describe "[doc tree revision]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

      {:ok, ~m(user community state)a}
    end

    test "bumps tree draft counters together", ~m(community state)a do
      assert {:ok, next_state} =
               CMS.DocTree.Revision.bump_tree_draft(community, state, staged_event_delta: 2)

      assert next_state.tree_lock_version == state.tree_lock_version + 1
      assert next_state.site_draft_version == state.site_draft_version + 1
      assert next_state.staged_event_count == state.staged_event_count + 2
    end

    test "bumps site draft without changing tree lock counter", ~m(community state)a do
      assert {:ok, next_state} = CMS.DocTree.Revision.bump_site_draft(community)

      assert next_state.site_draft_version == state.site_draft_version + 1
      assert next_state.tree_lock_version == state.tree_lock_version
      assert next_state.staged_event_count == state.staged_event_count
    end
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)
end
