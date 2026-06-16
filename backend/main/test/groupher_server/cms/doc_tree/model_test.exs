defmodule GroupherServer.Test.CMS.DocTree.ModelTest do
  @moduledoc false

  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{DocDocumentDraft, DocTreeNode, DocTreeNodeDraft}

  describe "DocTreeNodeDraft changeset" do
    test "page nodes require doc_draft_id" do
      changeset =
        DocTreeNodeDraft.changeset(%DocTreeNodeDraft{}, %{
          community_id: 1,
          parent_id: 1,
          type: :page,
          title: "Install",
          slug: "install",
          index: 0
        })

      refute changeset.valid?
      assert "page nodes require doc_draft_id" in errors_on(changeset).doc_draft_id
    end

    test "link nodes can not carry doc_draft_id" do
      changeset =
        DocTreeNodeDraft.changeset(%DocTreeNodeDraft{}, %{
          community_id: 1,
          parent_id: 1,
          doc_draft_id: 2,
          type: :link,
          title: "Docs",
          slug: "docs",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?
      assert "link nodes can not reference doc drafts" in errors_on(changeset).doc_draft_id
    end
  end

  describe "DocTreeNode changeset" do
    test "page nodes require doc_id" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          parent_id: 1,
          type: :page,
          title: "Install",
          slug: "install",
          index: 0
        })

      refute changeset.valid?
      assert "page nodes require doc_id" in errors_on(changeset).doc_id
    end

    test "group nodes can not carry href" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          type: :group,
          title: "Guides",
          slug: "guides",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?
      assert "group nodes can not have href" in errors_on(changeset).href
    end
  end

  describe "DocDocumentDraft update_changeset" do
    test "accepts doc_draft_id as a constrained field" do
      changeset =
        DocDocumentDraft.update_changeset(%DocDocumentDraft{}, %{
          doc_draft_id: 1,
          plain_text: "body"
        })

      assert Enum.any?(changeset.constraints, fn constraint ->
               constraint.field == :doc_draft_id and
                 constraint.constraint == "doc_document_drafts_doc_draft_id_fkey"
             end)
    end
  end
end
