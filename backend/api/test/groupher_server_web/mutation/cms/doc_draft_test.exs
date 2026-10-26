defmodule GroupherServer.Test.Mutation.CMS.DocDraft do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Docs.Branch

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Draft Title"}]},
                %{"type" => "p", "children" => [%{"text" => "saved draft body"}]}
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
      CMS.DocTree.create_group_internal(community, %{
        parent_node_id: root_doc_tab_node_id(community),
        title: "Guides",
        slug: "guides",
        base_revision: tree_state.tree_lock_version
      })

    {:ok, page_payload} =
      CMS.DocTree.create_page_internal(
        community,
        %{
          parent_node_id: group_payload.node.id,
          title: "Install",
          slug: "install",
          base_revision: group_payload.revision
        },
        user
      )

    {:ok, ~m(user user_conn community page_payload)a}
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
      assert queried["body"]["json"] == ~s([{"children":[{"text":""}],"type":"p"}])

      updated =
        user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          expectedVersion: expected_version(community, doc_id),
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
      assert updated["body"]["json"] == @plate_body
    end

    test "an empty subtitle falls back to the BodyBag summary",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      updated =
        user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          expectedVersion: expected_version(community, doc_id),
          title: "Imported Doc",
          subtitle: "",
          slug: "imported-doc",
          bodyBag: body_bag(@plate_body, :base)
        })

      assert updated["digest"] == "Saved draft body"
      assert updated["subtitle"] in [nil, ""]
      assert updated["body"]["json"] == @plate_body
    end

    test "requires slug when updating doc draft title", ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      assert user_conn
             |> mutation_error?(S.Doc.m(:update_draft), %{
               community: community.slug,
               id: doc_id,
               expectedVersion: expected_version(community, doc_id),
               title: "Needs Slug"
             })
    end

    test "returns version-owned asset refs for a doc draft",
         ~m(user user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id
      {:ok, branch} = Branch.resolve(community, nil)
      draft = Repo.get_by!(CMS.Model.DocDraft, article_id: doc_id, branch_id: branch.id)

      {:ok, asset} =
        CMS.Assets.register_to_community(
          community,
          %{
            url: "https://assets.groupher.test/doc-draft.png",
            filename: "doc-draft.png",
            mime_type: "image/png",
            size_bytes: 128,
            width: 1200,
            height: 630
          },
          user,
          Ecto.UUID.generate()
        )

      assert {:ok, _ref} =
               ORM.create(CMS.Model.ArticleAssetRef, %{
                 community_id: community.id,
                 asset_id: asset.id,
                 body_draft_id: draft.body_draft_id,
                 usage: :inline,
                 block_id: "doc-image"
               })

      queried =
        user_conn
        |> gq_query(S.Doc.q(:draft), %{community: community.slug, id: doc_id})

      assert [ref] = queried["assetRefs"]
      assert ref["blockId"] == "doc-image"
      assert ref["usage"] == "INLINE"
      assert ref["asset"]["id"] == to_string(asset.id)
    end

    test "returns a stable error code for a stale draft version",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      assert user_conn
             |> mutation_error?(
               S.Doc.m(:update_draft),
               %{
                 community: community.slug,
                 id: doc_id,
                 expectedVersion: expected_version(community, doc_id) + 1,
                 title: "Stale update",
                 slug: "stale-update",
                 bodyBag: body_bag(@plate_body, :base)
               },
               ErrorCat.code(CMS.ErrorCat.draft_version_conflict())
             )
    end

    test "replays the same update command without applying it twice",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id
      command_id = Ecto.UUID.generate()

      variables = %{
        community: community.slug,
        id: doc_id,
        commandId: command_id,
        expectedVersion: expected_version(community, doc_id),
        title: "Replay-safe update",
        slug: "replay-safe-update",
        bodyBag: body_bag(@plate_body, :base)
      }

      first = gq_mutation(user_conn, S.Doc.m(:update_draft), variables)
      replay = gq_mutation(user_conn, S.Doc.m(:update_draft), variables)

      assert replay == first
      assert replay["version"] == variables.expectedVersion + 1
      assert expected_version(community, doc_id) == replay["version"]
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
               expectedVersion: expected_version(community, doc_id),
               bodyBag: body_bag(@plate_body, :base)
             })

      updated =
        direct_user_conn
        |> gq_mutation(S.Doc.m(:update_draft), %{
          community: community.slug,
          id: doc_id,
          expectedVersion: expected_version(community, doc_id),
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
          expectedVersion: expected_version(community, doc_id),
          title: "Invalid Slug",
          slug: "invalid_slug",
          bodyBag: body_bag(@plate_body, :base)
        })

      assert updated["slug"] == "invalid_slug"
    end

    test "rejects invalid persisted draft slug on publish",
         ~m(user_conn community page_payload)a do
      doc_id = page_payload.node.doc_id

      user_conn
      |> gq_mutation(S.Doc.m(:update_draft), %{
        community: community.slug,
        id: doc_id,
        expectedVersion: expected_version(community, doc_id),
        title: "Publish Guard",
        slug: "publish-guard",
        bodyBag: body_bag(@plate_body, :base)
      })

      from(d in CMS.Model.DocDraft, where: d.article_id == ^doc_id)
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

  defp expected_version(community, doc_id) do
    {:ok, branch} = Branch.resolve(community, nil)

    Repo.one!(
      from(d in CMS.Model.DocDraft,
        where: d.article_id == ^doc_id and d.branch_id == ^branch.id,
        select: d.version
      )
    )
  end
end
