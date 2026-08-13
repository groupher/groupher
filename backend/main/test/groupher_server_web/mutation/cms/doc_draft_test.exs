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

    user_conn =
      :user
      |> simu_conn(user)
      |> Plug.Conn.put_req_header(
        "x-groupher-test-service-auth",
        "enabled"
      )

    {:ok, tree_state} = ORM.find_by(CMS.Model.DocsSiteState, community_id: community.id)

    {:ok, group_payload} =
      CMS.DocTree.create_group(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: tree_state.tree_lock_version
      })

    {:ok, page_payload} =
      CMS.DocTree.create_page(
        community,
        %{
          parent_node_id: group_payload.node.id,
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
      doc_id = page_payload.node.doc_id

      queried =
        user_conn
        |> gq_query(S.Doc.q(:draft), %{community: community.slug, id: doc_id})

      assert queried["docId"] == to_string(doc_id)
      assert queried["title"] == "Install"
      assert queried["subtitle"] == nil
      assert queried["document"]["json"] == ~s([{"children":[{"text":""}],"type":"p"}])

      updated =
        user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          title: "测试一下中文",
          subtitle: "这是页面副标题",
          slug: "ce-shi-yi-xia-zhong-wen",
          bodyBag: body_bag(@plate_body, :base)
        })

      assert updated["docId"] == to_string(doc_id)
      assert updated["title"] == "测试一下中文"
      assert updated["subtitle"] == "这是页面副标题"
      assert updated["digest"] == "这是页面副标题"
      assert updated["slug"] == "ce-shi-yi-xia-zhong-wen"
      assert updated["document"]["json"] == @plate_body
    end

    test "requires slug when updating doc draft title", ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      assert user_conn
             |> mutation_error?(S.Doc.m(:update_draft), %{
               community: community.slug,
               id: doc_id,
               title: "Needs Slug"
             })
    end

    test "requires publisher proof for BodyBag but not metadata-only updates",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      direct_user_conn =
        Plug.Conn.delete_req_header(user_conn, "x-groupher-test-service-auth")

      assert direct_user_conn
             |> mutation_error?(S.Doc.m(:update_draft), %{
               community: community.slug,
               id: doc_id,
               bodyBag: body_bag(@plate_body, :base)
             })

      updated =
        direct_user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          title: "Metadata Only",
          slug: "metadata-only"
        })

      assert updated["title"] == "Metadata Only"
      assert updated["slug"] == "metadata-only"
    end

    test "can stage an invalid doc draft slug before publish validation",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      updated =
        user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          title: "Invalid Slug",
          slug: "invalid_slug",
          bodyBag: body_bag(@plate_body, :base)
        })

      assert updated["slug"] == "invalid_slug"
    end

    test "can checkpoint, dedupe, list, and restore doc draft revisions",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      first_draft =
        user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          title: "Versioned Draft",
          subtitle: "First subtitle",
          slug: "versioned-draft",
          bodyBag: body_bag(@plate_body, :base)
        })

      first_revision =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert first_revision["stage"] == "DRAFT"
      assert first_revision["thread"] == "DOC"
      assert first_revision["articleHashId"] == to_string(doc_id)
      assert first_revision["revisionNumber"] == 1
      assert first_revision["title"] == first_draft["title"]
      assert first_revision["subtitle"] == "First subtitle"
      assert first_revision["digest"] == "First subtitle"
      assert first_revision["documentJson"] == @plate_body
      assert first_revision["author"]["login"]

      unchanged_revision =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert unchanged_revision["id"] == first_revision["id"]

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        bodyBag: body_bag(@plate_body_with_node_ids, :base)
      })

      subtitle_revision =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert subtitle_revision["id"] != first_revision["id"]
      assert subtitle_revision["revisionNumber"] == 2
      assert subtitle_revision["subtitle"] == "Second subtitle"
      assert subtitle_revision["documentJson"] == @plate_body_with_node_ids

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        bodyBag: body_bag(@plate_body_with_node_ids, :base)
      })

      id_only_revision =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert id_only_revision["id"] == subtitle_revision["id"]

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Versioned Draft",
        subtitle: "Second subtitle",
        slug: "versioned-draft",
        bodyBag: body_bag(@plate_body_updated, :updated)
      })

      second_revision =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert second_revision["id"] != first_revision["id"]
      assert second_revision["revisionNumber"] == 3
      assert second_revision["documentJson"] == @plate_body_updated

      revisions =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "DRAFT"
        })

      assert Enum.map(revisions, & &1["id"]) == [
               second_revision["id"],
               subtitle_revision["id"],
               first_revision["id"]
             ]

      restored =
        user_conn
        |> gq_mutation(S.Doc.m(:restore_snapshot), %{
          community: community.slug,
          id: doc_id,
          snapshotId: first_revision["id"]
        })

      assert restored["document"]["json"] == @plate_body
      assert restored["subtitle"] == "First subtitle"

      all_revisions =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{community: community.slug, id: doc_id})

      assert Enum.map(all_revisions, & &1["action"]) == [
               "RESTORE",
               "CHECKPOINT",
               "CHECKPOINT",
               "CHECKPOINT"
             ]
    end

    test "can publish doc draft revisions and restore published history linearly",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Published Draft",
        subtitle: "Published subtitle",
        slug: "published-draft",
        bodyBag: body_bag(@plate_body, :base)
      })

      site_draft_version =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      assert %{"done" => true, "release" => %{"id" => _}} =
               user_conn
               |> gq_mutation(S.Doc.m(:publish_changes), %{
                 community: community.slug,
                 input: %{docChangeIds: ["doc:#{doc_id}"], treeChangeIds: []}
               })

      [first_published] =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "PUBLIC"
        })

      assert first_published["stage"] == "PUBLIC"
      assert first_published["thread"] == "DOC"
      assert first_published["articleHashId"] == to_string(doc_id)
      assert first_published["revisionNumber"] == 2
      assert first_published["subtitle"] == "Published subtitle"
      assert first_published["digest"] == "Published subtitle"
      assert first_published["documentJson"] == @plate_body

      site_draft_versions_after_publish =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "DRAFT"
        })

      assert Enum.map(site_draft_versions_after_publish, & &1["action"]) == ["CHECKPOINT"]

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Published Draft",
        subtitle: "Published subtitle updated",
        slug: "published-draft",
        bodyBag: body_bag(@plate_body_updated, :updated)
      })

      later_site_draft_version =
        user_conn
        |> gq_mutation(S.Doc.m(:checkpoint_snapshot), %{
          community: community.slug,
          id: doc_id
        })

      {:ok, draft_before_second_publish} =
        ORM.find_by(CMS.Model.Doc,
          community_id: community.id,
          article_hash_id: doc_id,
          stage: :draft
        )

      {:ok, draft_document_before_second_publish} =
        ORM.find_by(CMS.Model.ArticleDocument,
          article_id: draft_before_second_publish.id,
          thread: :doc
        )

      assert %{"done" => true, "release" => %{"id" => _}} =
               user_conn
               |> gq_mutation(S.Doc.m(:publish_changes), %{
                 community: community.slug,
                 input: %{docChangeIds: ["doc:#{doc_id}"], treeChangeIds: []}
               })

      [second_published, _first_published_again] =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "PUBLIC"
        })

      assert second_published["articleHashId"] == first_published["articleHashId"]
      assert second_published["revisionNumber"] == 4
      assert second_published["subtitle"] == "Published subtitle updated"
      assert second_published["documentJson"] == @plate_body_updated

      {:ok, public_doc} =
        ORM.find_by(CMS.Model.Doc,
          community_id: community.id,
          article_hash_id: doc_id,
          stage: :public
        )

      {:ok, public_article_document} =
        ORM.find_by(CMS.Model.ArticleDocument, article_id: public_doc.id, thread: :doc)

      assert public_article_document.json == @plate_body_updated

      document_payload_fields =
        ~w(json markdown markdown_toc html plain_text digest body_hash schema_version)a

      assert Map.take(public_article_document, document_payload_fields) ==
               Map.take(draft_document_before_second_publish, document_payload_fields)

      {:error, _} =
        ORM.find_by(CMS.Model.ArticleDocument,
          article_id: draft_before_second_publish.id,
          thread: :doc
        )

      published_versions =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "PUBLIC"
        })

      assert Enum.map(published_versions, & &1["id"]) == [
               second_published["id"],
               first_published["id"]
             ]

      user_conn
      |> gq_mutation(S.Doc.m(:restore_snapshot), %{
        community: community.slug,
        id: doc_id,
        snapshotId: first_published["id"]
      })

      published_after_restore =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "PUBLIC"
        })

      draft_after_restore =
        user_conn
        |> gq_query(S.Doc.q(:draft_snapshots), %{
          community: community.slug,
          id: doc_id,
          stage: "DRAFT"
        })

      assert Enum.map(published_after_restore, & &1["id"]) == [
               second_published["id"],
               first_published["id"]
             ]

      assert Enum.map(draft_after_restore, & &1["action"]) == [
               "RESTORE",
               "CHECKPOINT",
               "CHECKPOINT"
             ]

      assert Enum.any?(draft_after_restore, &(&1["id"] == site_draft_version["id"]))
      assert Enum.any?(draft_after_restore, &(&1["id"] == later_site_draft_version["id"]))
    end

    test "rejects invalid persisted draft slug on publish",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Publish Guard",
        slug: "publish-guard",
        bodyBag: body_bag(@plate_body, :base)
      })

      from(d in CMS.Model.Doc,
        where: d.article_hash_id == ^doc_id and d.stage == :draft
      )
      |> Repo.update_all(set: [slug: "invalid_slug"])

      assert user_conn
             |> mutation_error?(S.Doc.m(:publish_changes), %{
               community: community.slug,
               input: %{docChangeIds: ["doc:#{doc_id}"], treeChangeIds: []}
             })
    end
  end

  defp body_bag(json, version) do
    body_hash =
      case version do
        :base -> String.duplicate("a", 64)
        :updated -> String.duplicate("b", 64)
      end

    %{
      json: json,
      markdown: "Saved draft body",
      html: "<p>Saved draft body</p>",
      toc: [],
      plainText: "Saved draft body",
      digest: "Saved draft body",
      bodyHash: body_hash,
      schemaVersion: 1
    }
  end

  defp empty_docs_community(user), do: create_empty_docs_community(user)
end
