defmodule GroupherServer.Test.CMS.DocTree.Write do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.Repo

  alias CMS.Model.{
    Doc,
    DocsSiteState,
    DocTreeEvent,
    DocTreeNode,
    DocTreeTrashItem
  }

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Updated Draft"}]},
                %{"type" => "p", "children" => [%{"text" => "draft body"}]}
              ])

  describe "[doc tree draft writes]" do
    test "creating a page without doc_id creates a draft doc and bumps revisions" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
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

      assert page_payload.node.type == :page
      assert page_payload.node.doc_id

      {:ok, doc_draft} = draft_doc(community, page_payload.node.doc_id)
      assert doc_draft.title == "Install"
      assert doc_draft.slug == "install"
      assert doc_draft.json =~ "Start writing your docs draft here."

      assert stage_count(DocTreeNode, community.id, :draft) == 2
      assert stage_count(Doc, community.id, :draft) == 1
      assert stage_count(DocTreeNode, community.id, :public) == 0
      assert stage_count(Doc, community.id, :public) == 0

      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.tree_lock_version == before_tree_state.tree_lock_version + 2
      assert tree_state.staged_event_count == 1
      assert site_state.site_draft_version == before_site_state.site_draft_version + 2
      assert site_state.published_version == 0

      {:ok, tree} = CMS.DocTree.read(community)
      assert [%{owner: "tree", event_type: "node.create"}] = tree.staged_events

      doc_id = page_payload.node.doc_id

      assert %DocTreeEvent{owner: :doc, doc_id: ^doc_id} =
               doc_owned_create_event(community, page_payload.node.id)
    end

    test "creating a duplicate page uses copy title and slug for tree and draft" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
        })

      {:ok, first_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
            title: "page-3",
            slug: "page-3",
            base_revision: group_payload.revision
          },
          user
        )

      {:ok, duplicate_payload} =
        CMS.DocTree.create_page(
          community,
          %{
            group_id: group_payload.node.id,
            title: "page-3",
            slug: "page-3",
            base_revision: first_payload.revision
          },
          user
        )

      assert duplicate_payload.node.title == "page-3-copy"
      assert duplicate_payload.node.slug == "page-3-copy"

      {:ok, doc_draft} = draft_doc(community, duplicate_payload.node.doc_id)
      assert doc_draft.title == "page-3-copy"
      assert doc_draft.slug == "page-3-copy"
      assert doc_draft.json =~ "page-3-copy"
    end

    test "stale base_revision returns conflict and does not mutate draft tree" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, first_payload} =
        CMS.DocTree.create_group(community, %{
          title: "One",
          slug: "one",
          base_revision: tree_state.tree_lock_version
        })

      {:ok, conflict_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Two",
          slug: "two",
          base_revision: tree_state.tree_lock_version
        })

      assert first_payload.conflict == false
      assert conflict_payload.conflict == true
      assert conflict_payload.revision == first_payload.revision

      assert DocTreeNode
             |> where([n], n.community_id == ^community.id)
             |> where([n], n.stage == :draft)
             |> select([n], n.title)
             |> Repo.all() == ["One"]
    end

    test "missing base_revision is rejected" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)

      assert {:error, {:custom, "base_revision is required"}} =
               CMS.DocTree.create_group(community, %{
                 title: "One",
                 slug: "one"
               })
    end

    test "creating a pin creates an independent top link node" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, pin_payload} =
        CMS.DocTree.create_pin(community, %{
          title: "GitHub",
          slug: "github",
          href: "https://github.com/groupher/groupher",
          base_revision: before_tree_state.tree_lock_version
        })

      assert pin_payload.node.type == :pin
      assert pin_payload.node.group_id == nil
      assert pin_payload.node.href == "https://github.com/groupher/groupher"

      {:ok, tree} = CMS.DocTree.read(community)

      assert [%{type: :pin, title: "GitHub", href: "https://github.com/groupher/groupher"}] =
               tree.pins

      assert tree.tree_state.staged_event_count == 1
      assert [%{event_type: "node.create"}] = tree.staged_events
    end

    test "page nodes can not be updated to remove doc draft reference" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
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

      assert {:error, changeset} =
               CMS.DocTree.update_node(community, page_payload.node.id, %{
                 doc_id: nil,
                 base_revision: page_payload.revision
               })

      assert %{doc_id: ["page nodes require doc_id"]} =
               errors_on(changeset)
    end

    test "updating a doc draft stores parsed body payload and bumps site draft revision only" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
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

      {:ok, draft} =
        CMS.DocTree.update_draft(
          community,
          page_payload.node.doc_id,
          %{
            title: "Updated Install",
            slug: "updated-install",
            body: @plate_body
          },
          user
        )

      assert draft.title == "Updated Install"
      assert draft.slug == "updated-install"
      assert draft.json == @plate_body
      assert draft.digest =~ "Updated Draft"

      {:ok, page_node} =
        ORM.find_by(DocTreeNode,
          community_id: community.id,
          stage: :draft,
          node_id: page_payload.node.id
        )

      assert page_node.title == "Install"
      assert page_node.slug == "install"

      {:ok, tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.tree_lock_version == group_payload.revision + 1
      assert site_state.site_draft_version == before_site_state.site_draft_version + 3
      assert site_state.published_version == 0
    end

    test "deleting a page writes docs trash snapshot and removes draft node" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.tree_lock_version
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

      {:ok, payload} =
        CMS.DocTree.delete_node(community, page_payload.node.id, %{
          base_revision: page_payload.revision,
          actor_id: user.id
        })

      assert payload.conflict == false
      refute draft_node_exists?(community, page_payload.node.id)

      {:ok, trash} =
        ORM.find_by(DocTreeTrashItem, community_id: community.id, node_id: page_payload.node.id)

      assert trash.doc_id == page_payload.node.doc_id
      assert trash.node_snapshot["id"] == page_payload.node.id
      assert trash.deleted_from_group_id == group_payload.node.id
    end
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end

  defp stage_count(schema, community_id, stage) do
    schema
    |> where([item], item.community_id == ^community_id)
    |> where([item], item.stage == ^stage)
    |> Repo.aggregate(:count, :id)
  end

  defp draft_node_exists?(community, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where([n], n.node_id == ^node_id)
    |> Repo.exists?()
  end

  defp doc_owned_create_event(community, node_id) do
    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.owner == :doc)
    |> where([e], e.event_type == "node.create")
    |> where([e], fragment("?->'node'->>'id'", e.payload) == ^node_id)
    |> Repo.one()
  end

  defp draft_doc(community, doc_id) do
    ORM.find_by(Doc, community_id: community.id, doc_id: doc_id, stage: :draft)
  end
end
