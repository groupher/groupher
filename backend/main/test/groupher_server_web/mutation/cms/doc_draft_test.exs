defmodule GroupherServer.Test.Mutation.CMS.DocDraft do
  @moduledoc false

  use GroupherServer.TestMate

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Draft Title"}]},
                %{"type" => "p", "children" => [%{"text" => "saved draft body"}]}
              ])

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = empty_docs_community(user)
    user_conn = simu_conn(:user, user)

    {:ok, group_payload} =
      CMS.DocTree.create_group(community, %{
        title: "Guides",
        slug: "guides"
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
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end
end
