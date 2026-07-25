defmodule GroupherServer.Test.CMS.DocTree.ModelTest do
  @moduledoc false

  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{
    Doc,
    DocTreeNode,
    PublishRequest,
    TrashedDocTreeNode
  }

  describe "Doc changeset" do
    test "requires branch scope" do
      changeset = Doc.changeset(%Doc{}, %{title: "Install", digest: "Install guide"})

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).branch_id
    end
  end

  describe "DocTreeNode changeset" do
    test "non-root nodes require a logical parent_node_id" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          branch_id: 1,
          node_id: "node-1",
          stage: :draft,
          doc_id: Ecto.UUID.generate(),
          type: :page,
          title: "Install",
          index: 0
        })

      refute changeset.valid?

      assert "node has an invalid docs tree parent" in errors_on(changeset).parent_node_id
    end

    test "page nodes require doc_id" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          branch_id: 1,
          node_id: "node-1",
          stage: :draft,
          parent_node_id: "group-1",
          type: :page,
          title: "Install",
          index: 0
        })

      refute changeset.valid?

      assert "page nodes require doc_id" in errors_on(changeset).doc_id
    end

    test "link nodes can not carry article refs" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          branch_id: 1,
          node_id: "node-1",
          stage: :draft,
          parent_node_id: "group-1",
          doc_id: Ecto.UUID.generate(),
          type: :link,
          title: "Docs",
          index: 0,
          href: "https://example.com"
        })

      refute changeset.valid?
      assert "link nodes can not reference articles" in errors_on(changeset).doc_id
    end

    test "pin nodes point to the owning Tab's logical node_id" do
      changeset =
        DocTreeNode.changeset(%DocTreeNode{}, %{
          community_id: 1,
          branch_id: 1,
          node_id: "pin-1",
          stage: :draft,
          type: :pin,
          parent_node_id: "tab-1",
          title: "GitHub",
          href: "https://github.com/groupher/groupher",
          index: 0
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

  describe "TrashedDocTreeNode changeset" do
    test "stores stage-specific Tree placement without Article content" do
      changeset =
        TrashedDocTreeNode.changeset(%TrashedDocTreeNode{}, %{
          trash_action_id: 1,
          community_id: 1,
          branch_id: 1,
          node_id: "page-1",
          doc_id: Ecto.UUID.generate(),
          type: :page,
          draft_snapshot: %{"nodeId" => "page-1", "type" => "page"},
          deleted_at: DateTime.utc_now(:second)
        })

      assert changeset.valid?
    end
  end
end
