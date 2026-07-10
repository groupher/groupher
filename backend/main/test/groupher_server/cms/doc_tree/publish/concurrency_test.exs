defmodule GroupherServer.Test.CMS.DocTree.Publish.Concurrency do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  describe "[doc tree publish concurrency]" do
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

      {:ok, _page_payload} =
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

      {:ok, ~m(user community)a}
    end

    test "serializes concurrent publish_changes for the same docs site", ~m(user community)a do
      assert CMS.DocTree.publish_checklist(community).total_count == 1

      results =
        1..2
        |> Enum.map(fn _ ->
          Task.async(fn -> CMS.DocTree.publish_changes(community, %{}, user) end)
        end)
        |> Task.await_many(10_000)

      assert Enum.all?(results, &match?({:ok, %{done: true}}, &1))

      releases =
        Enum.map(results, fn {:ok, %{release: release}} -> release end)

      assert Enum.count(releases, &match?(%CMS.Model.PublishRelease{}, &1)) == 1
      assert Enum.count(releases, &is_nil/1) == 1
      assert release_count(community) == 1
      assert CMS.DocTree.publish_checklist(community).total_count == 0
    end
  end

  defp empty_docs_community(user) do
    community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

    with {:ok, community} <- CMS.Communities.create(community_attrs, user),
         {:ok, _} <- CMS.DocTree.delete_demo_template(community) do
      {:ok, community}
    end
  end

  defp release_count(community) do
    CMS.Model.PublishRelease
    |> where([r], r.community_id == ^community.id)
    |> Repo.aggregate(:count, :id)
  end
end
