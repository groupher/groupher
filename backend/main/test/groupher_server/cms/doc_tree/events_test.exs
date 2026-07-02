defmodule GroupherServer.Test.CMS.DocTree.Events do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.DocTreeEvent

  require CMS.Const

  @node_key CMS.Const.doc_tree_json_key(:node)
  @id_key CMS.Const.doc_tree_json_key(:id)
  @type_key CMS.Const.doc_tree_json_key(:type)
  @doc_id_key CMS.Const.doc_tree_json_key(:doc_id)
  @page_type to_string(CMS.Const.tree_node_type(:page))

  describe "[doc tree events]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)

      {:ok, ~m(user community)a}
    end

    test "records staged events in order", ~m(user community)a do
      assert {:ok, [first, second]} =
               CMS.DocTree.Events.record_staged_many(
                 community,
                 [
                   node_create_event("page-1"),
                   node_create_event("page-2")
                 ],
                 user.id
               )

      assert first.seq < second.seq
      assert first.status == CMS.Const.tree_event_status(:staged)
      assert first.owner == CMS.Const.tree_event_owner(:tree)
      assert first.event_type == CMS.Const.tree_event(:node_create)
    end

    test "publishes only selected staged tree events", ~m(user community)a do
      {:ok, first} = record_node_create(community, "page-1", user)
      {:ok, second} = record_node_create(community, "page-2", user)

      assert {:ok, snapshot} =
               CMS.DocTree.Events.publish_snapshot(
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
        CMS.DocTree.Events.record_staged(
          community,
          CMS.Const.tree_event(:node_update),
          %{},
          %{},
          user.id,
          owner: CMS.Const.tree_event_owner(:doc),
          doc_id: doc_id
        )

      {:ok, legacy_event} = record_node_create(community, "page-1", user, doc_id)

      assert CMS.DocTree.Events.discard_doc_bound_staged(community, [doc_id]) == 2

      {:ok, doc_event} = ORM.find(DocTreeEvent, doc_event.id)
      {:ok, legacy_event} = ORM.find(DocTreeEvent, legacy_event.id)

      assert doc_event.status == CMS.Const.tree_event_status(:discarded)
      assert legacy_event.status == CMS.Const.tree_event_status(:discarded)
    end
  end

  defp record_node_create(community, node_id, user, doc_id \\ Ecto.UUID.generate()) do
    CMS.DocTree.Events.record_staged(
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

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end
end
