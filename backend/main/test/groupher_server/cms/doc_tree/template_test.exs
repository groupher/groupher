defmodule GroupherServer.Test.CMS.DocTree.Template do
  @moduledoc false

  use GroupherServer.TestMate

  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias CMS.Model.{ArticleDraft, Doc, DocTreeNode, DocTreeNodeDraft}

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

      assert draft_count(DocTreeNodeDraft, community.id) == 6
      assert draft_count(ArticleDraft, community.id) == 4

      assert draft_count(DocTreeNode, community.id) == 0
      assert draft_count(Doc, community.id) == 0
    end

    test "can delete and reset docs draft template" do
      {:ok, user} = db_insert(:user)
      community_attrs = mock_attrs(:community) |> Map.merge(%{user: user})

      {:ok, community} = CMS.Communities.create(community_attrs, user)

      {:ok, tree} = CMS.DocTree.delete_demo_template(community)
      assert tree.groups == []
      assert draft_count(DocTreeNodeDraft, community.id) == 0
      assert draft_count(ArticleDraft, community.id) == 0

      {:ok, tree} = CMS.DocTree.reset_demo_template(community, user)
      assert Enum.map(tree.groups, & &1.title) == ["Getting started", "Core Features"]
      assert draft_count(DocTreeNodeDraft, community.id) == 6
      assert draft_count(ArticleDraft, community.id) == 4
    end
  end

  defp draft_count(schema, community_id) do
    schema
    |> where([item], item.community_id == ^community_id)
    |> Repo.aggregate(:count, :id)
  end
end
