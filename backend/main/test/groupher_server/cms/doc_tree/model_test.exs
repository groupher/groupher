defmodule GroupherServer.Test.CMS.DocTree.ModelTest do
  @moduledoc false

  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{ArticleDraft, DocTreeNode, DocTreeNodeDraft}

  describe "ArticleDraft changeset" do
    test "rejects invalid slug format" do
      changeset =
        ArticleDraft.changeset(%ArticleDraft{}, %{
          community_id: 1,
          thread: :doc,
          title: "Install",
          slug: "install_page",
          digest: "Install",
          json: "[]"
        })

      refute changeset.valid?
      assert "only lowercase letters, numbers and hyphen are allowed" in errors_on(changeset).slug
    end
  end

  describe "DocTreeNodeDraft changeset" do
    test "rejects invalid slug format" do
      changeset =
        DocTreeNodeDraft.changeset(%DocTreeNodeDraft{}, %{
          community_id: 1,
          parent_id: 1,
          article_draft_id: 2,
          type: :page,
          title: "Install",
          slug: "install_page",
          index: 0
        })

      refute changeset.valid?
      assert "only lowercase letters, numbers and hyphen are allowed" in errors_on(changeset).slug
    end

    test "page nodes require article_draft_id" do
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
      assert "page nodes require article_draft_id" in errors_on(changeset).article_draft_id
    end

    test "link nodes can not carry article_draft_id" do
      changeset =
        DocTreeNodeDraft.changeset(%DocTreeNodeDraft{}, %{
          community_id: 1,
          parent_id: 1,
          article_draft_id: 2,
          type: :link,
          title: "Docs",
          slug: "docs",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?

      assert "link nodes can not reference article drafts" in errors_on(changeset).article_draft_id
    end

    test "pin nodes require only a target node reference" do
      changeset =
        DocTreeNodeDraft.changeset(%DocTreeNodeDraft{}, %{
          community_id: 1,
          type: :pin,
          target_node_id: 2,
          index: 0,
          ui_config: %{"variant" => "compact"}
        })

      assert changeset.valid?
    end
  end

  describe "DocTreeNode changeset" do
    test "rejects invalid slug format" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          parent_id: 1,
          doc_id: 2,
          type: :page,
          title: "Install",
          slug: "install_page",
          index: 0
        })

      refute changeset.valid?
      assert "only lowercase letters, numbers and hyphen are allowed" in errors_on(changeset).slug
    end

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

    test "pin nodes require target_node_id" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          type: :pin,
          index: 0
        })

      refute changeset.valid?
      assert "pin nodes require target_node_id" in errors_on(changeset).target_node_id
    end
  end
end
