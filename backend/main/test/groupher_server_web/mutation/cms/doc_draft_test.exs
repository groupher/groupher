defmodule GroupherServer.Test.Mutation.CMS.DocDraft do
  @moduledoc false

  use GroupherServer.TestMate

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Draft Title"}]},
                %{"type" => "p", "children" => [%{"text" => "saved draft body"}]}
              ])
  @plate_body_with_node_ids Jason.encode!([
                              %{
                                "id" => "node-a",
                                "type" => "h1",
                                "children" => [%{"text" => "Draft Title"}]
                              },
                              %{
                                "id" => "node-b",
                                "type" => "p",
                                "children" => [%{"text" => "saved draft body"}]
                              }
                            ])
  @plate_body_updated Jason.encode!([
                        %{"type" => "h1", "children" => [%{"text" => "Draft Title"}]},
                        %{"type" => "p", "children" => [%{"text" => "updated draft body"}]}
                      ])

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    user_conn = simu_conn(:user, user)
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

    {:ok, ~m(user_conn community page_payload)a}
  end

  describe "[doc draft]" do
    test "can query and update a dashboard doc draft", ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      queried =
        user_conn
        |> gq_query(Schema.q(:doc_draft), %{community: community.slug, id: workspace_id})

      assert queried["id"] == to_string(workspace_id)
      assert queried["title"] == "Install"
      assert queried["subtitle"] == nil
      assert queried["document"]["json"] =~ "Start writing your docs draft here."

      updated =
        user_conn
        |> gq_mutation(Schema.m(:update_doc_draft), %{
          community: community.slug,
          id: workspace_id,
          title: "测试一下中文",
          subtitle: "这是页面副标题",
          slug: "ce-shi-yi-xia-zhong-wen",
          body: @plate_body
        })

      assert updated["id"] == to_string(workspace_id)
      assert updated["title"] == "测试一下中文"
      assert updated["subtitle"] == "这是页面副标题"
      assert updated["digest"] == "这是页面副标题"
      assert updated["slug"] == "ce-shi-yi-xia-zhong-wen"
      assert updated["document"]["json"] == @plate_body
      assert is_binary(updated["document"]["html"])
      assert is_binary(updated["document"]["xml"])
      assert is_binary(updated["document"]["rss"])
    end

    test "requires slug when updating doc draft title", ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      assert user_conn
             |> mutation_error?(Schema.m(:update_doc_draft), %{
               community: community.slug,
               id: workspace_id,
               title: "Needs Slug"
             })
    end

    test "rejects invalid doc draft slug on update", ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      assert user_conn
             |> mutation_error?(Schema.m(:update_doc_draft), %{
               community: community.slug,
               id: workspace_id,
               title: "Invalid Slug",
               slug: "invalid_slug",
               body: @plate_body
             })
    end

    test "can checkpoint, dedupe, list, and restore doc draft revisions",
         ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      first_draft =
        user_conn
        |> gq_mutation(Schema.m(:update_doc_draft), %{
          community: community.slug,
          id: workspace_id,
          title: "Versioned Draft",
          subtitle: "First subtitle",
          slug: "versioned-draft",
          body: @plate_body
        })

      first_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert first_revision["stage"] == "DRAFT"
      assert first_revision["articleThread"] == "DOC"
      assert first_revision["workspaceId"] == to_string(workspace_id)
      assert first_revision["snapshotNumber"] == 1
      assert first_revision["title"] == first_draft["title"]
      assert first_revision["subtitle"] == "First subtitle"
      assert first_revision["digest"] == "First subtitle"
      assert first_revision["documentJson"] == @plate_body
      assert first_revision["author"]["login"]

      unchanged_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert unchanged_revision["id"] == first_revision["id"]

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        body: @plate_body_with_node_ids
      })

      subtitle_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert subtitle_revision["id"] != first_revision["id"]
      assert subtitle_revision["snapshotNumber"] == 2
      assert subtitle_revision["subtitle"] == "Second subtitle"
      assert subtitle_revision["documentJson"] == @plate_body_with_node_ids

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        body: @plate_body_with_node_ids
      })

      id_only_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert id_only_revision["id"] == subtitle_revision["id"]

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        body: @plate_body_updated
      })

      second_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert second_revision["id"] != first_revision["id"]
      assert second_revision["snapshotNumber"] == 3
      assert second_revision["documentJson"] == @plate_body_updated

      revisions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "DRAFT"
        })

      assert Enum.map(revisions, & &1["id"]) == [
               second_revision["id"],
               subtitle_revision["id"],
               first_revision["id"]
             ]

      restored =
        user_conn
        |> gq_mutation(Schema.m(:restore_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id,
          snapshotId: first_revision["id"]
        })

      assert restored["document"]["json"] == @plate_body
      assert restored["subtitle"] == "First subtitle"

      all_revisions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{community: community.slug, id: workspace_id})

      assert Enum.map(all_revisions, & &1["id"]) == [first_revision["id"]]
    end

    test "can publish doc draft revisions and restore published history linearly",
         ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Published Draft",
        subtitle: "Published subtitle",
        slug: "published-draft",
        body: @plate_body
      })

      site_draft_version =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert %{"done" => true, "release" => %{"id" => _}} =
               user_conn
               |> gq_mutation(Schema.m(:publish_doc_changes), %{
                 community: community.slug,
                 input: %{docChangeIds: ["doc:#{workspace_id}"], treeChangeIds: []}
               })

      [first_published] =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "PUBLIC"
        })

      assert first_published["stage"] == "PUBLIC"
      assert first_published["articleThread"] == "DOC"
      assert first_published["articleId"]
      assert first_published["workspaceId"] == nil
      assert first_published["snapshotNumber"] == 1
      assert first_published["subtitle"] == "Published subtitle"
      assert first_published["digest"] == "Published subtitle"
      assert first_published["documentJson"] == @plate_body

      site_draft_versions_after_publish =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "DRAFT"
        })

      assert site_draft_versions_after_publish == []

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Published Draft",
        subtitle: "Published subtitle updated",
        slug: "published-draft",
        body: @plate_body_updated
      })

      later_site_draft_version =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_snapshot), %{
          community: community.slug,
          id: workspace_id
        })

      assert %{"done" => true, "release" => %{"id" => _}} =
               user_conn
               |> gq_mutation(Schema.m(:publish_doc_changes), %{
                 community: community.slug,
                 input: %{docChangeIds: ["doc:#{workspace_id}"], treeChangeIds: []}
               })

      [second_published, _first_published_again] =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "PUBLIC"
        })

      assert second_published["articleId"] == first_published["articleId"]
      assert second_published["snapshotNumber"] == 2
      assert second_published["subtitle"] == "Published subtitle updated"
      assert second_published["documentJson"] == @plate_body_updated

      published_versions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "PUBLIC"
        })

      assert Enum.map(published_versions, & &1["id"]) == [
               second_published["id"],
               first_published["id"]
             ]

      user_conn
      |> gq_mutation(Schema.m(:restore_doc_draft_snapshot), %{
        community: community.slug,
        id: workspace_id,
        snapshotId: first_published["id"]
      })

      published_after_restore =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "PUBLIC"
        })

      draft_after_restore =
        user_conn
        |> gq_query(Schema.q(:doc_draft_snapshots), %{
          community: community.slug,
          id: workspace_id,
          stage: "DRAFT"
        })

      assert Enum.map(published_after_restore, & &1["id"]) == [
               second_published["id"],
               first_published["id"]
             ]

      assert draft_after_restore == []
      refute Enum.any?(draft_after_restore, &(&1["id"] == site_draft_version["id"]))
      refute Enum.any?(draft_after_restore, &(&1["id"] == later_site_draft_version["id"]))
    end

    test "rejects invalid persisted draft slug on publish",
         ~m(user_conn community page_payload)a do
      workspace_id = page_payload.node.workspace_id

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: workspace_id,
        title: "Publish Guard",
        slug: "publish-guard",
        body: @plate_body
      })

      from(d in CMS.Model.ArticleWorkspace, where: d.id == ^workspace_id)
      |> Repo.update_all(set: [slug: "invalid_slug"])

      assert user_conn
             |> mutation_error?(Schema.m(:publish_doc_changes), %{
               community: community.slug,
               input: %{docChangeIds: ["doc:#{workspace_id}"], treeChangeIds: []}
             })
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
