defmodule GroupherServer.Test.CMS.DocTree.Cover do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

    {:ok, group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        base_revision: tree_state.tree_lock_version
      })

    {:ok, page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group.node.id,
          title: "Install",
          slug: "install",
          base_revision: group.revision
        },
        user
      )

    {:ok, ~m(user community group page)a}
  end

  test "publishing navigation does not implicitly create a Cover Card",
       ~m(user community)a do
    assert {:ok, %{done: true}} = publish_all_changes(community, user)
    assert {:ok, %{cards: [], pinned_docs: []}} = CMS.DocCover.read(community)
  end

  test "a Group Card projects direct Page, Link, and nested Group items",
       ~m(user community group page)a do
    {:ok, link} =
      CMS.DocTree.create_link(community, %{
        parent_node_id: group.node.id,
        title: "GitHub",
        href: "https://github.com/groupher",
        base_revision: page.revision
      })

    {:ok, nested_group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: group.node.id,
        title: "Advanced",
        base_revision: link.revision
      })

    {:ok, nested_page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: nested_group.node.id,
          title: "Performance",
          slug: "performance",
          base_revision: nested_group.revision
        },
        user
      )

    {:ok, deep_group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: nested_group.node.id,
        title: "Runtime",
        base_revision: nested_page.revision
      })

    {:ok, _deep_link} =
      CMS.DocTree.create_link(community, %{
        parent_node_id: deep_group.node.id,
        title: "Runtime API",
        href: "https://example.com/runtime",
        base_revision: deep_group.revision
      })

    assert {:ok, %{done: true}} = publish_all_changes(community, user)
    assert {:ok, _card} = CMS.DocCover.add_card(community, group.node.id, user)
    assert {:ok, %{cards: [card]}} = CMS.DocCover.read(community)

    assert card.group_node_id == group.node.id
    assert card.title == "Guides"

    assert [
             %{
               type: :group,
               title: "Advanced",
               leaf_count: 2,
               href: nested_href
             },
             %{type: :page, title: "Install", href: page_href},
             %{type: :link, title: "GitHub", href: "https://github.com/groupher"}
           ] = card.items

    assert page_href =~ "/install"
    assert nested_href == "https://example.com/runtime"
  end

  test "adding a parent Card atomically replaces selected descendant Cards",
       ~m(user community group page)a do
    {:ok, nested_group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: group.node.id,
        title: "Advanced",
        base_revision: page.revision
      })

    {:ok, _nested_page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: nested_group.node.id,
          title: "Performance",
          slug: "performance",
          base_revision: nested_group.revision
        },
        user
      )

    assert {:ok, %{done: true}} = publish_all_changes(community, user)
    assert {:ok, descendant_card} = CMS.DocCover.add_card(community, nested_group.node.id, user)
    assert descendant_card.index == 0

    assert {:ok, parent_card} = CMS.DocCover.add_card(community, group.node.id, user)
    assert parent_card.index == 0

    assert {:ok, %{cards: [%{group_node_id: group_node_id}]}} = CMS.DocCover.read(community)
    assert group_node_id == group.node.id
  end

  test "an existing ancestor Card blocks adding a descendant Card",
       ~m(user community group page)a do
    {:ok, nested_group} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: group.node.id,
        title: "Advanced",
        base_revision: page.revision
      })

    {:ok, _nested_page} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: nested_group.node.id,
          title: "Performance",
          slug: "performance",
          base_revision: nested_group.revision
        },
        user
      )

    assert {:ok, %{done: true}} = publish_all_changes(community, user)
    assert {:ok, _parent_card} = CMS.DocCover.add_card(community, group.node.id, user)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :custom, details: message}} =
             CMS.DocCover.add_card(community, nested_group.node.id, user)

    assert message =~ "ancestor Cover Card"
  end

  test "Cover Card sources must be published Groups", ~m(user community page)a do
    assert {:ok, %{done: true}} = publish_all_changes(community, user)

    assert {:error,
            %GroupherServer.ErrorCat.Error{
              reason: :custom,
              details: "A Cover Card must reference a published Group."
            }} =
             CMS.DocCover.add_card(community, page.node.id, user)
  end

  test "pinned docs remain independent from Group Card ancestry", ~m(user community page)a do
    assert {:ok, %{done: true}} = publish_all_changes(community, user)
    assert {:ok, _pin} = CMS.DocCover.pin_doc(community, page.node.id, user)

    assert {:ok, %{cards: [], pinned_docs: [%{node_id: node_id, doc: %{title: "Install"}}]}} =
             CMS.DocCover.read(community)

    assert node_id == page.node.id
  end

  defp publish_all_changes(community, user) do
    CMS.DocTree.publish_changes(community, %{}, user)
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)
end
