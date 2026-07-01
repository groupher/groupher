defmodule GroupherServer.Test.CMS.DocTree.Cover do
  @moduledoc false

  use GroupherServer.TestMate

  describe "[doc cover sync]" do
    setup do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: tree_state.tree_lock_version
        })

      {:ok, page_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
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
      {:ok, revision} = publish_doc_change(community, page_payload.node.doc_id, user)
      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert revision.stage == :public
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
      assert page.publish_state.public_doc_id == revision.doc_id
      assert page.publish_state.last_published_at
      assert page.publish_state.in_cover == true
      assert page.publish_state.hidden_from_cover == false

      {:ok, page_event} =
        ORM.find_by(CMS.Model.DocTreeEvent,
          community_id: community.id,
          owner: :doc,
          doc_id: page_payload.node.doc_id
        )

      assert page_event.status == :published
    end

    test "dashboard cover view returns editor hrefs with draft doc ids",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
      {:ok, cover} = CMS.DocCover.read(community, :dashboard)

      assert [%{items: [%{node: %{href: href}}]}] = cover.groups

      assert href ==
               "/#{community.slug}/dashboard/doc/editor?docId=#{page_payload.node.doc_id}"
    end

    test "doc-only publish creates published mapping without cover rows",
         ~m(user community page_payload)a do
      {:ok, revision} =
        publish_doc_change(community, page_payload.node.doc_id, user, sync_cover: false)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert revision.stage == :public
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
            group_id: group_payload.node.id,
            title: "Advanced",
            slug: "advanced",
            base_revision: page_payload.revision
          },
          user
        )

      assert {:ok, %{done: true}} = publish_all_changes(community, user)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: [%{node: %{title: "Install"}}, %{node: %{title: "Advanced"}}]}] =
               cover.groups

      [group] = tree.groups
      assert Enum.all?(group.children, & &1.publish_state.published)
      assert Enum.all?(group.children, & &1.publish_state.in_cover)

      assert CMS.DocTree.publish_scope(community).doc_changes == []

      assert second_page_payload.node.title == "Advanced"
    end

    test "publishes a group with page and link children while syncing only pages to cover",
         ~m(user community group_payload page_payload)a do
      {:ok, link_payload} =
        CMS.DocTree.create_link(community, %{
          group_id: group_payload.node.id,
          title: "External",
          slug: "external",
          href: "https://example.com",
          base_revision: page_payload.revision
        })

      assert {:ok, %{done: true}} = publish_all_changes(community, user)

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

    test "move group to draft is a deprecated no-op in the stage model",
         ~m(user community group_payload page_payload)a do
      {:ok, _link_payload} =
        CMS.DocTree.create_link(community, %{
          group_id: group_payload.node.id,
          title: "External",
          slug: "external",
          href: "https://example.com",
          base_revision: page_payload.revision
        })

      assert {:ok, %{done: true}} = publish_all_changes(community, user)

      assert {:ok, %{done: true}} =
               CMS.DocTree.move_group_to_draft(community, group_payload.node.id)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: [%{node: %{title: "Install"}}]}] = cover.groups

      [group] = tree.groups
      assert group.publish_state.status == :public
      assert Enum.all?(group.children, &(&1.publish_state.status == :public))
      assert Enum.all?(group.children, &(&1.publish_state.published_before == true))
    end

    test "tree node changes are staged at Tree scope instead of page publish scope",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
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
      refute page.publish_state.has_unpublished_changes
      assert tree.tree_state.has_unpublished_changes
      assert tree.tree_state.staged_event_count > 0
      assert Enum.any?(tree.staged_events, &(&1.event_type == "node.rename"))

      assert CMS.DocTree.publish_scope(community).doc_changes == []
    end

    test "publishes staged Tree changes into a Tree snapshot release",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)

      {:ok, payload} =
        CMS.DocTree.update_node(community, page_payload.node.id, %{
          title: "Install v2",
          slug: "install-v2",
          base_revision: page_payload.revision
        })

      assert payload.tree_state.has_unpublished_changes

      assert {:ok, %{done: true, release: release}} = publish_tree_changes(community, user)
      tree_snapshot = release.tree_snapshot

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      refute tree.tree_state.has_unpublished_changes
      assert tree.tree_state.base_snapshot_id == tree_snapshot.id
      assert tree.tree_state.latest_snapshot_id == tree_snapshot.id
      assert tree.tree_state.latest_release_number == release.release_number
      assert tree.staged_events == []
      assert page.title == "Install v2"
      assert page.publish_state.status == :public
      refute page.publish_state.has_unpublished_changes
    end

    test "Tree publish copies independent pin link nodes through the normal node tables",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)

      {:ok, tree} = CMS.DocTree.read(community)

      {:ok, pin_payload} =
        CMS.DocTree.create_pin(community, %{
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: tree.revision,
          ui_config: %{"variant" => "compact"}
        })

      pin_id = pin_payload.node.id
      pin_json_id = pin_payload.node.id

      {:ok, tree} = CMS.DocTree.read(community)

      assert [
               %{
                 id: ^pin_id,
                 type: :pin,
                 title: "GitHub",
                 href: "https://github.com/groupher/groupher"
               }
             ] = tree.pins

      assert {:ok, %{done: true, release: release}} = publish_tree_changes(community, user)
      tree_snapshot = release.tree_snapshot

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      assert [%{id: ^pin_id, type: :pin, title: "GitHub"}] = tree.pins
      assert page.publish_state.public_node_id

      {:ok, published_pin} =
        ORM.find_by(CMS.Model.DocTreeNode,
          community_id: community.id,
          stage: :public,
          type: :pin
        )

      assert published_pin.href == "https://github.com/groupher/groupher"
      assert published_pin.ui_config == %{"variant" => "compact"}

      assert [
               %{
                 "id" => ^pin_json_id,
                 "type" => "pin",
                 "title" => "GitHub",
                 "href" => "https://github.com/groupher/groupher",
                 "uiConfig" => %{"variant" => "compact"}
               }
             ] = tree_snapshot.tree_json["pins"]
    end

    test "Tree publish skips doc-owned draft-only pages",
         ~m(user community page_payload)a do
      assert {:ok, %{done: true, release: release}} = publish_tree_changes(community, user)
      tree_snapshot = release.tree_snapshot

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      refute tree.tree_state.has_unpublished_changes
      assert tree.staged_events == []
      assert page.publish_state.status == :draft
      assert page.publish_state.published == false
      assert page_payload.node.title == "Install"

      assert [%{"children" => []}] = tree_snapshot.tree_json["groups"]
    end

    test "Tree publish removes public nodes deleted from the draft tree",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
      {:ok, _tree_publish} = publish_tree_changes(community, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == :public

      assert {:ok, _payload} =
               CMS.DocTree.delete_node(community, page_payload.node.id, %{
                 base_revision: tree.revision
               })

      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      assert group.children == []
      assert tree.tree_state.has_unpublished_changes

      assert {:ok, %{done: true}} = publish_tree_changes(community, user)

      {:ok, tree} = CMS.DocTree.read(community)
      {:ok, cover} = CMS.DocCover.read(community)

      [group] = tree.groups
      assert group.children == []
      refute tree.tree_state.has_unpublished_changes
      assert [%{items: []}] = cover.groups
    end

    test "move doc to draft creates a draft copy while public cover stays intact",
         ~m(user community page_payload)a do
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
      {:ok, tree} = CMS.DocTree.read(community)
      [group] = tree.groups
      [page] = group.children
      public_node_id = page.publish_state.public_node_id

      assert page.publish_state.status == :public
      assert page.publish_state.in_cover == true

      assert {:ok, %{stage: :draft}} =
               CMS.DocTree.move_doc_to_draft(community, page_payload.node.id, user)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{items: [%{node: %{title: "Install"}}]}] = cover.groups

      [group] = tree.groups
      [page] = group.children

      assert page.publish_state.status == :public
      assert page.publish_state.published == true
      assert page.publish_state.published_before == true
      assert page.publish_state.public_node_id == public_node_id
      assert page.publish_state.in_cover == true

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            subtitle: "Later update"
          },
          user
        )

      {:ok, _revision} =
        publish_doc_change(community, page_payload.node.doc_id, user, sync_cover: false)

      {:ok, cover} = CMS.DocCover.read(community)
      {:ok, tree} = CMS.DocTree.read(community)
      [_group] = tree.groups
      page = tree.groups |> hd() |> Map.fetch!(:children) |> hd()

      assert page.publish_state.status == :public
      assert page.publish_state.public_node_id == public_node_id
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
      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
      {:ok, item} = CMS.DocCover.set_item_hidden(community, page_payload.node.id, true)

      assert item.hidden == true

      {:ok, _draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            subtitle: "Later update"
          },
          user
        )

      {:ok, _revision} = publish_doc_change(community, page_payload.node.doc_id, user)
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

  defp publish_doc_change(community, doc_id, user, opts \\ []) do
    input = %{doc_change_ids: ["doc:#{doc_id}"], tree_change_ids: []}

    with {:ok, %{release: release}} <- CMS.DocTree.publish_changes(community, input, user, opts) do
      release = Repo.preload(release, :articles)
      [article] = release.articles

      ORM.find(CMS.Model.ArticleSnapshot, article.snapshot_id)
    end
  end

  defp publish_all_changes(community, user, opts \\ []) do
    CMS.DocTree.publish_changes(community, %{}, user, opts)
  end

  defp publish_tree_changes(community, user) do
    with {:ok, %{release: release} = result} <-
           CMS.DocTree.publish_changes(community, %{doc_change_ids: []}, user) do
      {:ok, %{result | release: Repo.preload(release, :tree_snapshot)}}
    end
  end
end
