defmodule GroupherServer.Test.Helper.PermissionRegistryTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias GroupherServer.ErrorCat

  alias Helper.PermissionRegistry

  @schema_root Path.expand("../../lib/groupher_server_web/schema", __DIR__)

  test "all schema action literals are registered" do
    action_literals_from_schema()
    |> Enum.each(fn action ->
      assert {:ok, requirement} = PermissionRegistry.requirement(action)
      assert valid_requirement?(requirement), "invalid requirement for action: #{action}"
    end)
  end

  test "article macro-generated actions are registered" do
    threads = article_reaction_threads()

    templates = [
      "%s.pin",
      "%s.undo_pin",
      "%s.trash",
      "%s.restore",
      "%s.permanent_delete",
      "%s.sink",
      "%s.undo_sink",
      "%s.lock_comment",
      "%s.undo_lock_comment"
    ]

    for thread <- threads, template <- templates do
      action = String.replace(template, "%s", thread)
      assert {:ok, requirement} = PermissionRegistry.requirement(action)
      assert valid_requirement?(requirement), "invalid requirement for action: #{action}"
    end
  end

  test "unknown action returns unknown_action error" do
    assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
             PermissionRegistry.requirement("this_action_does_not_exist")
  end

  test "allowed? checks global grants and god bypass" do
    assert {:ok, true} =
             PermissionRegistry.allowed?(
               %{"global" => %{"community.create" => true}},
               nil,
               "community.create"
             )

    assert {:ok, false} =
             PermissionRegistry.allowed?(%{"global" => %{}}, nil, "community.create")

    assert {:ok, true} =
             PermissionRegistry.allowed?(%{"global" => %{"god" => true}}, nil, "doc.update")
  end

  test "allowed?/4 expands thread-scoped global requirements" do
    passport = %{"global" => %{"post.community.mirror" => true}}

    assert {:ok, true} =
             PermissionRegistry.allowed?(passport, "demo", "article.mirror", :post)

    assert {:ok, false} =
             PermissionRegistry.allowed?(passport, "demo", "article.mirror", :blog)

    assert {:ok, false} = PermissionRegistry.allowed?(passport, "demo", "article.mirror")
  end

  test "allowed? checks context grants and requires a community" do
    passport = %{
      "global" => %{},
      "demo" => %{"cms" => %{"post.set_category" => true}}
    }

    assert {:ok, true} = PermissionRegistry.allowed?(passport, "demo", "post.set_category")

    assert {:error, %ErrorCat.Error{reason: :community_required}} =
             PermissionRegistry.allowed?(passport, nil, "post.set_category")
  end

  test "ordinary Article legacy actions and grants are retired" do
    for action <- [
          "post.update",
          "post.draft.update",
          "post.draft.publish",
          "blog.update",
          "blog.draft.update",
          "blog.draft.publish",
          "changelog.update",
          "changelog.draft.update",
          "changelog.draft.publish"
        ] do
      assert {:error, %ErrorCat.Error{reason: :unknown_action}} =
               PermissionRegistry.requirement(action)
    end

    refute PermissionRegistry.valid_context_permission?(:cms, "post.edit")
    refute PermissionRegistry.valid_context_permission?(:cms, "blog.edit")
    refute PermissionRegistry.valid_context_permission?(:cms, "changelog.edit")
    assert PermissionRegistry.valid_context_permission?(:cms, "doc.edit")
    assert PermissionRegistry.valid_context_permission?(:cms, "post.set_category")
  end

  test "valid_rules? accepts normalized shape only" do
    normalized = %{
      "global" => %{"category.set" => true, "community.update" => true},
      "javascript" => %{"cms" => %{"post.pin" => true}}
    }

    assert PermissionRegistry.valid_rules?(normalized)

    refute PermissionRegistry.valid_rules?(%{
             "community.update" => true,
             "javascript" => %{"post.pin" => true}
           })

    refute PermissionRegistry.valid_rules?(%{
             "global" => %{"bad.perm" => true},
             "javascript" => %{"cms" => %{}}
           })

    refute PermissionRegistry.valid_rules?(%{
             "global" => %{},
             "javascript" => %{"cms" => %{"category.set" => true}}
           })

    refute PermissionRegistry.valid_rules?(%{
             "global" => %{},
             "javascript" => %{"communities" => %{"post.pin" => true}}
           })
  end

  test "normalize_rules keeps community slug named cms as community scope" do
    normalized =
      PermissionRegistry.normalize_rules(%{
        "global" => %{},
        "cms" => %{"root" => true, "cms" => %{"post.pin" => true}}
      })

    assert get_in(normalized, ["cms", "root"]) == true
    assert get_in(normalized, ["cms", "cms", "post.pin"]) == true
  end

  test "normalize_rules still migrates legacy top-level cms context shape" do
    normalized =
      PermissionRegistry.normalize_rules(%{
        "global" => %{},
        "cms" => %{"javascript" => %{"post.pin" => true}}
      })

    assert get_in(normalized, ["javascript", "cms", "post.pin"]) == true
  end

  defp action_literals_from_schema do
    @schema_root
    |> Path.join("**/*.ex")
    |> Path.wildcard()
    |> Enum.flat_map(fn file ->
      file
      |> File.read!()
      |> then(&Regex.scan(~r/action:\s*"([^"]+)"/, &1, capture: :all_but_first))
      |> Enum.map(&List.first/1)
    end)
    |> Enum.uniq()
  end

  defp article_reaction_threads do
    @schema_root
    |> Path.join("cms/mutations/*.ex")
    |> Path.wildcard()
    |> Enum.flat_map(fn file ->
      file
      |> File.read!()
      |> then(&Regex.scan(~r/article_react_mutations\(:([a-z_]+),/, &1, capture: :all_but_first))
      |> Enum.map(&List.first/1)
    end)
    |> Enum.uniq()
  end

  defp valid_requirement?(%{owner_fallback: true} = requirement)
       when map_size(requirement) == 1 do
    true
  end

  defp valid_requirement?(%{scope: scope} = requirement) when scope in [:global, :context] do
    is_binary(requirement[:grant]) or is_binary(requirement[:grant_by_thread])
  end

  defp valid_requirement?(_), do: false
end
