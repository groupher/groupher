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

    {:ok, ~m(user_conn community page_payload)a}
  end

  describe "[doc draft]" do
    test "can query and update a dashboard doc draft", ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      queried =
        user_conn
        |> gq_query(Schema.q(:doc_draft), %{community: community.slug, id: doc_id})

      assert queried["id"] == to_string(doc_id)
      assert queried["title"] == "Install"
      assert queried["document"]["json"] =~ "Start writing your docs draft here."

      updated =
        user_conn
        |> gq_mutation(Schema.m(:update_doc_draft), %{
          community: community.slug,
          id: doc_id,
          title: "测试一下中文",
          slug: "ce-shi-yi-xia-zhong-wen",
          body: @plate_body
        })

      assert updated["id"] == to_string(doc_id)
      assert updated["title"] == "测试一下中文"
      assert updated["slug"] == "ce-shi-yi-xia-zhong-wen"
      assert updated["document"]["json"] == @plate_body
      assert is_binary(updated["document"]["html"])
      assert is_binary(updated["document"]["xml"])
      assert is_binary(updated["document"]["rss"])
    end

    test "requires slug when updating doc draft title", ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      assert user_conn
             |> mutation_error?(Schema.m(:update_doc_draft), %{
               community: community.slug,
               id: doc_id,
               title: "Needs Slug"
             })
    end

    test "rejects invalid doc draft slug on update", ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      assert user_conn
             |> mutation_error?(Schema.m(:update_doc_draft), %{
               community: community.slug,
               id: doc_id,
               title: "Invalid Slug",
               slug: "invalid_slug",
               body: @plate_body
             })
    end

    test "can checkpoint, dedupe, list, and restore doc draft revisions",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      first_draft =
        user_conn
        |> gq_mutation(Schema.m(:update_doc_draft), %{
          community: community.slug,
          id: doc_id,
          title: "Versioned Draft",
          slug: "versioned-draft",
          body: @plate_body
        })

      first_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert first_revision["type"] == "DRAFT"
      assert first_revision["thread"] == "DOC"
      assert first_revision["articleDraftId"] == to_string(doc_id)
      assert first_revision["revisionNumber"] == 1
      assert first_revision["title"] == first_draft["title"]
      assert first_revision["documentJson"] == @plate_body
      assert first_revision["author"]["login"]

      unchanged_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert unchanged_revision["id"] == first_revision["id"]

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Versioned Draft",
        slug: "versioned-draft",
        body: @plate_body_with_node_ids
      })

      id_only_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert id_only_revision["id"] == first_revision["id"]

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Versioned Draft",
        slug: "versioned-draft",
        body: @plate_body_updated
      })

      second_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert second_revision["id"] != first_revision["id"]
      assert second_revision["revisionNumber"] == 2
      assert second_revision["documentJson"] == @plate_body_updated

      revisions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{
          community: community.slug,
          id: doc_id,
          type: "DRAFT"
        })

      assert Enum.map(revisions, & &1["id"]) == [second_revision["id"], first_revision["id"]]

      restored =
        user_conn
        |> gq_mutation(Schema.m(:restore_doc_draft_revision), %{
          community: community.slug,
          id: doc_id,
          revisionId: first_revision["id"]
        })

      assert restored["document"]["json"] == @plate_body

      all_revisions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{community: community.slug, id: doc_id})

      assert Enum.map(all_revisions, & &1["id"]) == [first_revision["id"]]
    end

    test "can publish doc draft revisions and restore published history linearly",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Published Draft",
        slug: "published-draft",
        body: @plate_body
      })

      draft_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      first_published =
        user_conn
        |> gq_mutation(Schema.m(:publish_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert first_published["type"] == "PUBLISHED"
      assert first_published["thread"] == "DOC"
      assert first_published["articleId"]
      assert first_published["articleDraftId"] == nil
      assert first_published["revisionNumber"] == 1
      assert first_published["documentJson"] == @plate_body

      draft_revisions_after_publish =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{
          community: community.slug,
          id: doc_id,
          type: "DRAFT"
        })

      assert draft_revisions_after_publish == []

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Published Draft",
        slug: "published-draft",
        body: @plate_body_updated
      })

      later_draft_revision =
        user_conn
        |> gq_mutation(Schema.m(:checkpoint_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      second_published =
        user_conn
        |> gq_mutation(Schema.m(:publish_doc_draft_revision), %{
          community: community.slug,
          id: doc_id
        })

      assert second_published["articleId"] == first_published["articleId"]
      assert second_published["revisionNumber"] == 2
      assert second_published["documentJson"] == @plate_body_updated

      published_revisions =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{
          community: community.slug,
          id: doc_id,
          type: "PUBLISHED"
        })

      assert Enum.map(published_revisions, & &1["id"]) == [
               second_published["id"],
               first_published["id"]
             ]

      user_conn
      |> gq_mutation(Schema.m(:restore_doc_draft_revision), %{
        community: community.slug,
        id: doc_id,
        revisionId: first_published["id"]
      })

      published_after_restore =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{
          community: community.slug,
          id: doc_id,
          type: "PUBLISHED"
        })

      draft_after_restore =
        user_conn
        |> gq_query(Schema.q(:doc_draft_revisions), %{
          community: community.slug,
          id: doc_id,
          type: "DRAFT"
        })

      assert Enum.map(published_after_restore, & &1["id"]) == [first_published["id"]]
      assert draft_after_restore == []
      refute Enum.any?(draft_after_restore, &(&1["id"] == draft_revision["id"]))
      refute Enum.any?(draft_after_restore, &(&1["id"] == later_draft_revision["id"]))
    end

    test "rejects invalid persisted draft slug on publish",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      user_conn
      |> gq_mutation(Schema.m(:update_doc_draft), %{
        community: community.slug,
        id: doc_id,
        title: "Publish Guard",
        slug: "publish-guard",
        body: @plate_body
      })

      from(d in CMS.Model.ArticleDraft, where: d.id == ^doc_id)
      |> Repo.update_all(set: [slug: "invalid_slug"])

      assert user_conn
             |> mutation_error?(Schema.m(:publish_doc_draft_revision), %{
               community: community.slug,
               id: doc_id
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
