defmodule GroupherServer.Test.CMS.DocTree.Events do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias GroupherServer.CMS.DocTree.Events, as: DocTreeEvents
  alias GroupherServer.CMS.Model.{DocTreeEvent, DocTreeNode}

  require CMS.Const

  @node_key CMS.Const.doc_tree_json_key(:node)
  @id_key CMS.Const.doc_tree_json_key(:id)
  @type_key CMS.Const.doc_tree_json_key(:type)
  @doc_id_key CMS.Const.doc_tree_json_key(:doc_id)
  @page_type to_string(CMS.Const.tree_node_type(:page))
  @group_type to_string(CMS.Const.tree_node_type(:group))
  @node_id_key "nodeId"
  @node_type_key "nodeType"

  describe "[doc tree events]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)

      {:ok, ~m(user community)a}
    end

    test "records staged events in order", ~m(user community)a do
      assert {:ok, [first, second]} =
               DocTreeEvents.record_staged_many(
                 community,
                 [
                   node_create_event("page-1"),
                   node_create_event("page-2")
                 ],
                 user.id
               )

      assert second.seq == first.seq + 1
      assert first.status == CMS.Const.tree_event_status(:staged)
      assert first.owner == CMS.Const.tree_event_owner(:tree)
      assert first.event_type == CMS.Const.tree_event(:node_create)
      assert first.node_id == "page-1"
      assert first.node_type == CMS.Const.tree_node_type(:page)
      assert first.doc_id
    end

    test "records no staged events from an empty list", ~m(user community)a do
      assert DocTreeEvents.record_staged_many(community, [], user.id) == {:ok, []}
    end

    test "publishes only selected staged tree events", ~m(user community)a do
      {:ok, first} = record_node_create(community, "page-1", user)
      {:ok, second} = record_node_create(community, "page-2", user)

      assert {:ok, snapshot} =
               DocTreeEvents.publish_snapshot(
                 community,
                 user.id,
                 "selected",
                 event_ids: [first.id]
               )

      {:ok, first} = ORM.find(DocTreeEvent, first.id)
      {:ok, second} = ORM.find(DocTreeEvent, second.id)

      assert first.status == CMS.Const.tree_event_status(:published)
      assert first.snapshot_id == snapshot.id
      assert second.status == CMS.Const.tree_event_status(:staged)
      assert is_nil(second.snapshot_id)
    end

    test "discards doc-bound staged events and legacy page-create events", ~m(user community)a do
      doc_id = Ecto.UUID.generate()

      {:ok, doc_event} =
        DocTreeEvents.record_staged(
          community,
          CMS.Const.tree_event(:node_update),
          %{},
          %{},
          user.id,
          owner: CMS.Const.tree_event_owner(:doc),
          doc_id: doc_id
        )

      {:ok, legacy_event} = record_node_create(community, "page-1", user, doc_id)

      assert DocTreeEvents.discard_doc_bound_staged(community, [doc_id]) == 2

      {:ok, doc_event} = ORM.find(DocTreeEvent, doc_event.id)
      {:ok, legacy_event} = ORM.find(DocTreeEvent, legacy_event.id)

      assert doc_event.status == CMS.Const.tree_event_status(:discarded)
      assert legacy_event.status == CMS.Const.tree_event_status(:discarded)
    end

    test "records selector columns from staged payload", ~m(user community)a do
      doc_id = Ecto.UUID.generate()

      assert {:ok, event} = record_node_create(community, "page-1", user, doc_id)

      assert event.node_id == "page-1"
      assert event.node_type == CMS.Const.tree_node_type(:page)
      assert event.doc_id == doc_id
    end

    test "records selector columns from flat node payloads", ~m(user community)a do
      doc_id = Ecto.UUID.generate()

      assert {:ok, group_event} =
               DocTreeEvents.record_staged(
                 community,
                 CMS.Const.tree_event(:node_move),
                 %{
                   @node_id_key => "group-1",
                   @node_type_key => @group_type,
                   "title" => "Group"
                 },
                 %{},
                 user.id
               )

      assert {:ok, page_event} =
               DocTreeEvents.record_staged(
                 community,
                 CMS.Const.tree_event(:node_move),
                 %{
                   @node_id_key => "page-1",
                   @node_type_key => @page_type,
                   @doc_id_key => doc_id,
                   "title" => "Page"
                 },
                 %{},
                 user.id
               )

      assert group_event.node_id == "group-1"
      assert group_event.node_type == CMS.Const.tree_node_type(:group)
      assert is_nil(group_event.doc_id)

      assert page_event.node_id == "page-1"
      assert page_event.node_type == CMS.Const.tree_node_type(:page)
      assert page_event.doc_id == doc_id
    end

    test "builds pin-specific event types" do
      before_pin = pin_node(title: "GitHub")
      after_pin = pin_node(title: "Groupher")

      assert %{type: "pin.add"} = DocTreeEvents.create_event(before_pin)
      assert %{type: "pin.remove"} = DocTreeEvents.delete_event(before_pin)
      assert %{type: "pin.reorder"} = DocTreeEvents.move_event(before_pin, nil, 0, nil, 1)
      assert [%{type: "pin.update"}] = DocTreeEvents.update_events(before_pin, after_pin)
    end
  end

  defp record_node_create(community, node_id, user, doc_id \\ Ecto.UUID.generate()) do
    DocTreeEvents.record_staged(
      community,
      CMS.Const.tree_event(:node_create),
      node_create_payload(node_id, doc_id),
      %{},
      user.id
    )
  end

  defp node_create_event(node_id), do: node_create_event(node_id, Ecto.UUID.generate())

  defp node_create_event(node_id, doc_id) do
    %{
      type: CMS.Const.tree_event(:node_create),
      payload: node_create_payload(node_id, doc_id),
      inverse: %{}
    }
  end

  defp node_create_payload(node_id, doc_id) do
    %{
      @node_key => %{
        @id_key => node_id,
        @type_key => @page_type,
        @doc_id_key => doc_id,
        "title" => "Page"
      }
    }
  end

  defp pin_node(attrs) do
    attrs =
      Enum.into(attrs, %{
        node_id: "pin-1",
        stage: CMS.Const.stage(:draft),
        type: CMS.Const.tree_node_type(:pin),
        title: "Pin",
        href: "https://example.com",
        parent_node_id: nil,
        index: 0
      })

    struct(DocTreeNode, attrs)
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)
end
