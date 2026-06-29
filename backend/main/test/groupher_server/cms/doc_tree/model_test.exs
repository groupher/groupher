defmodule GroupherServer.Test.CMS.DocTree.ModelTest do
  @moduledoc false

  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{
    ArticleWorkspace,
    DocTreeNode,
    DocTreeTrashItem,
    PublishRequest
  }

  describe "ArticleWorkspace changeset" do
    test "rejects invalid slug format" do
      changeset =
        ArticleWorkspace.changeset(%ArticleWorkspace{}, %{
          community_id: 1,
          article_thread: :doc,
          stage: :draft,
          title: "Install",
          slug: "install_page",
          digest: "Install",
          json: "[]"
        })

      refute changeset.valid?
      assert "only lowercase letters, numbers and hyphen are allowed" in errors_on(changeset).slug
    end
  end

  describe "DocTreeNode changeset" do
    test "rejects invalid slug format" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          workspace_id: 2,
          type: :page,
          title: "Install",
          slug: "install_page",
          index: 0
        })

      refute changeset.valid?
      assert "only lowercase letters, numbers and hyphen are allowed" in errors_on(changeset).slug
    end

    test "draft page nodes require workspace_id only" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          type: :page,
          title: "Install",
          slug: "install",
          index: 0
        })

      refute changeset.valid?

      assert "draft pages require workspace_id only" in errors_on(changeset).workspace_id
    end

    test "public page nodes require doc_id only" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :public,
          group_id: "group-1",
          workspace_id: 2,
          type: :page,
          title: "Install",
          slug: "install",
          index: 0
        })

      refute changeset.valid?
      assert "public pages require doc_id only" in errors_on(changeset).doc_id
    end

    test "link nodes can not carry article refs" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          workspace_id: 2,
          type: :link,
          title: "Docs",
          slug: "docs",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?
      assert "link nodes can not reference articles" in errors_on(changeset).workspace_id
    end

    test "pin nodes are independent top-level links" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "pin-1",
          stage: :draft,
          type: :pin,
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          index: 0,
          ui_config: %{"variant" => "compact"}
        })

      assert changeset.valid?
    end
  end

  describe "PublishRequest changeset" do
    test "accepts future doc tree review request shape" do
      changeset =
        PublishRequest.changeset(%PublishRequest{}, %{
          target_type: "doc_tree",
          target_id: "42",
          status: :pending
        })

      assert changeset.valid?
    end
  end

  describe "DocTreeTrashItem changeset" do
    test "stores docs-specific tree trash snapshot" do
      changeset =
        DocTreeTrashItem.changeset(%DocTreeTrashItem{}, %{
          community_id: 1,
          node_id: "page-1",
          workspace_id: 2,
          node_snapshot: %{"id" => "page-1"},
          deleted_at: DateTime.utc_now(:second)
        })

      assert changeset.valid?
    end
  end
end
