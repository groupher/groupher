defmodule GroupherServer.Test.CMS.DocTree.Snapshot do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.DocTreeNode

  require CMS.Const

  @doc_id_key CMS.Const.doc_tree_json_key(:doc_id)
  @id_key CMS.Const.doc_tree_json_key(:id)
  @type_key CMS.Const.doc_tree_json_key(:type)
  @group_type CMS.Const.tree_node_type(:group)
  @tab_type CMS.Const.tree_node_type(:tab)
  @page_type CMS.Const.tree_node_type(:page)
  @pin_type CMS.Const.tree_node_type(:pin)

  describe "[doc tree snapshot]" do
    test "serializes page article reference as the doc tree json doc id key" do
      doc_id = Ecto.UUID.generate()

      json =
        %DocTreeNode{
          stage: CMS.Const.stage(:draft),
          type: @page_type,
          node_id: "page-1",
          doc_id: doc_id,
          title: "Install"
        }
        |> CMS.DocTree.Snapshot.node_json()

      assert json[@id_key] == "page-1"
      assert json[@type_key] == to_string(@page_type)
      assert json[@doc_id_key] == doc_id
    end

    test "builds canonical tree json from flat nodes" do
      tab = %DocTreeNode{
        stage: CMS.Const.stage(:draft),
        type: @tab_type,
        node_id: "tab-1",
        title: "Introduction",
        index: 0
      }

      group = %DocTreeNode{
        stage: CMS.Const.stage(:draft),
        type: @group_type,
        node_id: "group-1",
        tab_id: "tab-1",
        title: "Guides",
        index: 0
      }

      page = %DocTreeNode{
        stage: CMS.Const.stage(:draft),
        type: @page_type,
        node_id: "page-1",
        group_id: "group-1",
        title: "Install",
        index: 0
      }

      pin = %DocTreeNode{
        stage: CMS.Const.stage(:draft),
        type: @pin_type,
        node_id: to_string(@pin_type),
        tab_id: "tab-1",
        title: "Pinned",
        index: 0
      }

      assert %{
               "version" => 2,
               "tabs" => [
                 %{
                   @id_key => "tab-1",
                   "pins" => [%{@id_key => "pin"}],
                   "groups" => [
                     %{@id_key => "group-1", "children" => [%{@id_key => "page-1"}]}
                   ]
                 }
               ]
             } = CMS.DocTree.Snapshot.from_nodes([page, pin, group, tab])
    end
  end
end
