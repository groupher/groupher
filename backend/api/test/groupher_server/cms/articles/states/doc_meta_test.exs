defmodule GroupherServer.Test.CMS.DocMeta do
  @moduledoc false
  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    {:ok, ~m(user community doc_attrs)a}
  end

  describe "[cms doc meta info]" do
    test "can get default meta info", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)
      state = Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id)
      refute state.is_edited
      refute state.comments_locked
    end

    test "is_edited flag should set to true after doc updated",
         ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)

      {:ok, _} =
        CMS.Docs.update_draft(
          doc.id,
          branch.id,
          %{title: "new title", expected_version: doc.version},
          user
        )

      assert Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id).is_edited
    end

    test "doc's lock/undo_lock article should work", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      branch = Repo.get_by!(CMS.Model.DocBranch, community_id: community.id, type: :main)

      {:ok, _} =
        CMS.Articles.lock_comments(doc.id, user, branch_id: branch.id, community: community)

      assert Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id).comments_locked

      {:ok, _} =
        CMS.Articles.undo_lock_comments(doc.id, user, branch_id: branch.id, community: community)

      refute Repo.get_by!(CMS.Model.DocBranchState, article_id: doc.id, branch_id: branch.id).comments_locked
    end
  end
end
