defmodule GroupherServer.Test.CMS.DocTree.Write do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false
  import GroupherServer.DataCase, only: [errors_on: 1]

  alias GroupherServer.Repo

  alias CMS.Model.{
    Doc,
    DocDraft,
    DocDocumentDraft,
    DocsSiteState,
    DocTreeDraftState,
    DocTreeNode,
    DocTreeNodeDraft
  }

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Updated Draft"}]},
                %{"type" => "p", "children" => [%{"text" => "draft body"}]}
              ])

  describe "[doc tree draft writes]" do
    test "creating a page without doc_id creates a draft doc and bumps revisions" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.revision
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

      assert page_payload.node.type == :page
      assert page_payload.node.doc_id

      {:ok, doc_draft} = ORM.find(DocDraft, page_payload.node.doc_id, preload: :document)
      assert doc_draft.title == "Install"
      assert doc_draft.slug == "install"
      assert doc_draft.document.json =~ "Start writing your docs draft here."

      assert draft_count(DocTreeNodeDraft, community.id) == 2
      assert draft_count(DocDraft, community.id) == 1
      assert Repo.aggregate(DocDocumentDraft, :count, :id) == 1
      assert draft_count(DocTreeNode, community.id) == 0
      assert draft_count(Doc, community.id) == 0

      {:ok, tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.revision == before_tree_state.revision + 2
      assert site_state.draft_revision == before_site_state.draft_revision + 2
      assert site_state.published_revision == 0
      assert site_state.last_published_draft_revision == 0
    end

    test "stale base_revision returns conflict and does not mutate draft tree" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)

      {:ok, first_payload} =
        CMS.DocTree.create_group(community, %{
          title: "One",
          slug: "one",
          base_revision: tree_state.revision
        })

      {:ok, conflict_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Two",
          slug: "two",
          base_revision: tree_state.revision
        })

      assert first_payload.conflict == false
      assert conflict_payload.conflict == true
      assert conflict_payload.revision == first_payload.revision

      assert DocTreeNodeDraft
             |> where([n], n.community_id == ^community.id)
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

    test "page nodes can not be updated to remove doc draft reference" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.revision
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

      assert {:error, changeset} =
               CMS.DocTree.update_node(community, page_payload.node.id, %{
                 doc_id: nil,
                 base_revision: page_payload.revision
               })

      assert %{doc_draft_id: ["page nodes require doc_draft_id"]} = errors_on(changeset)
    end

    test "updating a doc draft stores parsed body payload and bumps site draft revision only" do
      {:ok, user} = db_insert(:user)
      {:ok, community} = empty_docs_community(user)
      {:ok, before_tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)
      {:ok, before_site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      {:ok, group_payload} =
        CMS.DocTree.create_group(community, %{
          title: "Guides",
          slug: "guides",
          base_revision: before_tree_state.revision
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

      {:ok, draft} =
        CMS.DocTree.update_draft(community, page_payload.node.doc_id, %{
          title: "Updated Install",
          slug: "updated-install",
          body: @plate_body
        })

      assert draft.title == "Updated Install"
      assert draft.slug == "updated-install"
      assert draft.document.json == @plate_body
      assert is_binary(draft.document.html)
      assert is_binary(draft.document.xml)
      assert draft.document.digest =~ "Updated Draft"

      {:ok, page_node} = ORM.find(DocTreeNodeDraft, page_payload.node.id)
      assert page_node.title == "Install"
      assert page_node.slug == "install"

      {:ok, tree_state} = ORM.find_by(DocTreeDraftState, community_id: community.id)
      {:ok, site_state} = ORM.find_by(DocsSiteState, community_id: community.id)

      assert tree_state.revision == group_payload.revision + 1
      assert site_state.draft_revision == before_site_state.draft_revision + 3
      assert site_state.published_revision == 0
    end
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end

  defp draft_count(schema, community_id) do
    schema
    |> where([item], item.community_id == ^community_id)
    |> Repo.aggregate(:count, :id)
  end
end
