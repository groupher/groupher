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
      assert updated["document"]["json"] == @plate_body
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
