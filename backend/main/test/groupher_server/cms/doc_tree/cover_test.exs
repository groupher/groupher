defmodule GroupherServer.Test.CMS.DocTree.Cover do
  @moduledoc false

  use GroupherServer.TestMate

  describe "[doc cover sync]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(CMS.Model.DocTreeDraftState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: tree_state.revision
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_id: group_payload.node.id,
            title: "Install",
            slug: "install",
            base_revision: group_payload.revision
          },
          user
        )

      {:ok, ~m(user community group_payload page_payload)a}
    end

    test "default publish syncs the group and page into the cover",
         ~m(user community page_payload)a do
      {:ok, revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert revision.type == :published
      assert [%{group: %{title: "Guides"}, items: [%{node: %{title: "Install"}}]}] = cover.groups
      assert cover.pinned_items == []

      [cover_group] = cover.groups
      [cover_item] = cover_group.items
      assert cover_item.node.href == "/#{community.slug}/doc/install"

      [group] = tree.groups
      [page] = group.children

      assert group.publish_state.in_cover == true
      assert page.publish_state.status == :public
      assert page.publish_state.published == true
      assert page.publish_state.published_doc_id == revision.article_id
      assert page.publish_state.last_published_at
      assert page.publish_state.in_cover == true
      assert page.publish_state.hidden_from_cover == false
    end

    test "dashboard cover view returns editor hrefs with draft doc ids",
         ~m(user community page_payload)a do
      {:ok, _revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, cover} = CMS.DocCover.read(community, :dashboard)

      assert [%{items: [%{node: %{href: href}}]}] = cover.groups
      assert href == "/#{community.slug}/dashboard/doc/editor?docId=#{page_payload.node.doc_id}"
    end

    test "doc-only publish creates published mapping without cover rows",
         ~m(user community page_payload)a do
      {:ok, revision} =
        CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user, sync_cover: false)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert revision.type == :published
      assert cover.groups == []
      assert cover.pinned_items == []

      [group] = tree.groups
      [page] = group.children

      assert group.publish_state.published == true
      assert page.publish_state.status == :public
      assert group.publish_state.in_cover == false
      assert page.publish_state.published == true
      assert page.publish_state.in_cover == false
    end

    test "publishes every unpublished page with cover sync",
         ~m(user community group_payload page_payload)a do
      {:ok, second_page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            parent_id: group_payload.node.id,
            title: "Advanced",
            slug: "advanced",
            base_revision: page_payload.revision
          },
          user
        )

      assert {:ok, %{done: true, count: 2}} =
               CMS.DocTree.publish_all_unpublished_docs(community, user)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: [%{node: %{title: "Install"}}, %{node: %{title: "Advanced"}}]}] =
               cover.groups

      [group] = tree.groups
      assert Enum.all?(group.children, & &1.publish_state.published)
      assert Enum.all?(group.children, & &1.publish_state.in_cover)

      assert {:ok, %{done: true, count: 0}} =
               CMS.DocTree.publish_all_unpublished_docs(community, user)

      assert second_page_payload.node.title == "Advanced"
    end

    test "publishes a group with page and link children while syncing only pages to cover",
         ~m(user community group_payload page_payload)a do
      {:ok, link_payload} =
        CMS.DocTree.create_link(community, %{
          parent_id: group_payload.node.id,
          title: "External",
          slug: "external",
          href: "https://example.com",
          base_revision: page_payload.revision
        })

      assert {:ok, %{done: true, count: 2}} =
               CMS.DocTree.publish_group(community, group_payload.node.id, user)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{group: %{title: "Guides"}, items: [%{node: %{title: "Install"}}]}] =
               cover.groups

      [group] = tree.groups
      [page, link] = group.children

      assert group.publish_state.status == :public
      assert page.publish_state.status == :public
      assert link.publish_state.status == :public
      assert page.publish_state.in_cover == true
      refute link.publish_state.in_cover
      assert link_payload.node.title == "External"
    end

    test "moves a group with page and link children back to draft visibility",
         ~m(user community group_payload page_payload)a do
      {:ok, _link_payload} =
        CMS.DocTree.create_link(community, %{
          parent_id: group_payload.node.id,
          title: "External",
          slug: "external",
          href: "https://example.com",
          base_revision: page_payload.revision
        })

      assert {:ok, %{done: true, count: 2}} =
               CMS.DocTree.publish_group(community, group_payload.node.id, user)

      assert {:ok, %{done: true, count: 3}} =
               CMS.DocTree.move_group_to_draft(community, group_payload.node.id)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert cover.groups == []

      [group] = tree.groups
      assert group.publish_state.status == :draft
      assert Enum.all?(group.children, &(&1.publish_state.status == :draft))
      assert Enum.all?(group.children, &(&1.publish_state.published_before == true))
    end

    test "publishes public docs with draft changes in the bulk action",
         ~m(user community page_payload)a do
      {:ok, _revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == :public
      refute page.publish_state.has_unpublished_changes

      {:ok, _payload} =
        CMS.DocTree.update_node(community, page_payload.node.id, %{
          title: "Install v2",
          slug: "install-v2",
          base_revision: page_payload.revision
        })

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == :public
      assert page.publish_state.has_unpublished_changes

      assert {:ok, %{done: true, count: 1}} =
               CMS.DocTree.publish_all_unpublished_docs(community, user)
    end

    test "moving a public doc to draft hides it from cover without deleting curation",
         ~m(user community page_payload)a do
      {:ok, _revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children
      published_node_id = page.publish_state.published_node_id

      assert page.publish_state.status == :public
      assert page.publish_state.in_cover == true

      assert {:ok, %{done: true}} = CMS.DocTree.move_doc_to_draft(community, page_payload.node.id)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: []}] = cover.groups

      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == :draft
      assert page.publish_state.published == false
      assert page.publish_state.published_before == true
      assert page.publish_state.published_node_id == published_node_id
      assert page.publish_state.in_cover == false

      {:ok, _revision} =
        CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user, sync_cover: false)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)
      [_group] = tree.groups
      page = tree.groups |> hd() |> Map.fetch!(:children) |> hd()

      assert page.publish_state.status == :public
      assert page.publish_state.published_node_id == published_node_id
      assert [%{items: [%{node: %{title: "Install"}}]}] = cover.groups
    end

    test "adding an unpublished group to cover returns a product warning",
         ~m(community group_payload)a do
      assert {:error, {:custom, "Publish it before adding it to cover."}} =
               CMS.DocCover.add_group(community, group_payload.node.id)

      {:ok, cover} = CMS.DocCover.read(community)
      assert cover.groups == []
    end

    test "hide from cover survives later publish sync", ~m(user community page_payload)a do
      {:ok, _revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, item} = CMS.DocCover.set_item_hidden(community, page_payload.node.id, true)

      assert item.hidden == true

      {:ok, _revision} = CMS.DocTree.publish_doc(community, page_payload.node.doc_id, user)
      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: []}] = cover.groups

      [_group] = tree.groups
      page = tree.groups |> hd() |> Map.fetch!(:children) |> hd()

      assert page.publish_state.in_cover == true
      assert page.publish_state.hidden_from_cover == true
    end
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end
end
