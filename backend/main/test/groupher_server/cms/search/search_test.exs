defmodule GroupherServer.Test.CMS.Search do
  @moduledoc false
  use GroupherServer.TestMate

  alias CMS.Search

  defp create_community!(user, attrs) do
    community_attrs = mock_attrs(:community, attrs)
    {:ok, community} = CMS.Communities.create(community_attrs, user)
    community
  end

  setup do
    {:ok, user} = db_insert(:user)
    _community = create_community!(user, %{title: "react"})
    _community = create_community!(user, %{title: "php"})
    _community = create_community!(user, %{title: "每日妹子"})
    _community = create_community!(user, %{title: "javascript"})
    _community = create_community!(user, %{title: "java"})

    {:ok, _community} = db_insert(:post, %{title: "react"})
    {:ok, _community} = db_insert(:post, %{title: "php"})
    {:ok, _community} = db_insert(:post, %{title: "每日妹子"})
    {:ok, _community} = db_insert(:post, %{title: "javascript"})
    {:ok, _community} = db_insert(:post, %{title: "java"})

    {:ok, ~m(user)a}
  end

  describe "[cms search post]" do
    test "search post by full title should valid paged posts" do
      {:ok, searched} = Search.article(:post, "react")

      assert searched |> is_valid_pagination?(:raw)
      assert searched.total_count == 1
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"
    end

    test "search post blur title should return valid communities" do
      {:ok, searched} = Search.article(:post, "reac")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.article(:post, "rea")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.article(:post, "eac")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.article(:post, "每日")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "每日妹子"

      {:ok, searched} = Search.article(:post, "javasc")
      assert searched.total_count == 1
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "javascript"

      {:ok, searched} = Search.article(:post, "java")
      assert searched.total_count == 2
      assert searched.entries |> Enum.any?(&(&1.title == "java"))
      assert searched.entries |> Enum.any?(&(&1.title == "javascript"))
    end

    test "search non exist post should get empty pagi data" do
      {:ok, searched} = Search.article(:post, "non-exist")
      assert searched |> is_valid_pagination?(:raw, :empty)
    end
  end

  describe "[cms search community with category]" do
    test "community with category can be searched", ~m(user)a do
      community = create_community!(user, %{title: "cool-pl"})
      {:ok, category} = db_insert(:category, %{slug: "pl"})

      {:ok, _} = CMS.Communities.set_category(community, category)

      {:ok, searched} = Search.community("cool-pl", "pl")
      assert searched.entries |> List.first() |> Map.get(:title) == "cool-pl"
    end
  end

  describe "[cms search community]" do
    test "search community by full title should valid paged communities" do
      {:ok, searched} = Search.community("react")

      assert searched |> is_valid_pagination?(:raw)
      assert searched.total_count == 1
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"
    end

    test "search community blur title should return valid communities" do
      {:ok, searched} = Search.community("reac")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.community("rea")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.community("eac")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "react"

      {:ok, searched} = Search.community("每日")
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "每日妹子"

      {:ok, searched} = Search.community("javasc")
      assert searched.total_count == 1
      assert searched.entries |> Enum.at(0) |> Map.get(:title) == "javascript"

      {:ok, searched} = Search.community("java")
      assert searched.total_count == 2
      assert searched.entries |> Enum.any?(&(&1.title == "java"))
      assert searched.entries |> Enum.any?(&(&1.title == "javascript"))
    end

    test "search non exist community should get empty pagi data" do
      {:ok, searched} = Search.community("non-exist")
      assert searched |> is_valid_pagination?(:raw, :empty)
    end
  end
end
