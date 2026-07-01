defmodule GroupherServer.Test.CMS.DocTree.ModelTest do
  @moduledoc false

  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{
    DocTreeNode,
    DocTreeTrashItem,
    PublishRequest
  }

  describe "DocTreeNode changeset" do
    test "rejects invalid slug format" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          doc_id: Ecto.UUID.generate(),
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
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          type: :page,
          title: "Install",
          slug: "install",
          index: 0
        })

      refute changeset.valid?

      assert "page nodes require doc_id" in errors_on(changeset).doc_id
    end

    test "link nodes can not carry article refs" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          node_id: "node-1",
          stage: :draft,
          group_id: "group-1",
          doc_id: Ecto.UUID.generate(),
          type: :link,
          title: "Docs",
          slug: "docs",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?
      assert "link nodes can not reference articles" in errors_on(changeset).doc_id
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
          doc_id: Ecto.UUID.generate(),
          node_snapshot: %{"id" => "page-1"},
          deleted_at: DateTime.utc_now(:second)
        })

      assert changeset.valid?
    end
  end
end
