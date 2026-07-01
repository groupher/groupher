defmodule GroupherServer.Test.CMS.DocTree.Template do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias CMS.Model.{Doc, DocTreeNode}

  describe "[doc tree demo template]" do
    test "community creation initializes docs draft template only" do
      {:ok, user} = db_insert(:user)
      community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

      {:ok, community} = CMS.Communities.create(community_attrs, user)
      {:ok, tree} = CMS.DocTree.read(community)

      assert Enum.map(tree.groups, & &1.title) == ["Getting started", "Core Features"]

      assert tree.groups
             |> Enum.flat_map(& &1.children)
             |> Enum.map(& &1.title) == ["Introduction", "Quick start", "Forum", "Changelog"]

      assert tree.groups
             |> Enum.flat_map(& &1.children)
             |> Enum.all?(& &1.doc_id)

      assert stage_count(DocTreeNode, community.id, :draft) == 6
      assert stage_count(Doc, community.id, :draft) == 4

      assert stage_count(DocTreeNode, community.id, :public) == 0
      assert stage_count(Doc, community.id, :public) == 0
    end

    test "can delete and reset docs draft template" do
      {:ok, user} = db_insert(:user)
      community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, tree} = CMS.DocTree.delete_demo_template(community)
      assert tree.groups == []
      assert stage_count(DocTreeNode, community.id, :draft) == 0
      assert stage_count(Doc, community.id, :draft) == 0

      {:ok, tree} = CMS.DocTree.reset_demo_template(community, user)
      assert Enum.map(tree.groups, & &1.title) == ["Getting started", "Core Features"]
      assert stage_count(DocTreeNode, community.id, :draft) == 6
      assert stage_count(Doc, community.id, :draft) == 4
    end
  end

  defp stage_count(schema, community_id, stage) do
    schema
    |> where([item], item.community_id == ^community_id)
    |> where([item], item.stage == ^stage)
    |> Repo.aggregate(:count, :id)
  end
end
