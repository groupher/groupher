defmodule GroupherServer.Test.Helper.PermissionRegistryTest do
  @moduledoc false
  use ExUnit.Case, async: true

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
      "mutate.pin_%s",
      "mutate.undo_pin_%s",
      "mutate.mark_delete_%s",
      "mutate.undo_mark_delete_%s",
      "mutate.batch_mark_delete_%ss",
      "mutate.batch_undo_mark_delete_%ss",
      "mutate.delete_%s",
      "mutate.sink_%s",
      "mutate.undo_sink_%s",
      "mutate.lock_%s_comment",
      "mutate.undo_lock_%s_comment"
    ]

    for thread <- threads, template <- templates do
      action = String.replace(template, "%s", thread)
      assert {:ok, requirement} = PermissionRegistry.requirement(action)
      assert valid_requirement?(requirement), "invalid requirement for action: #{action}"
    end
  end

  test "unknown action returns unknown_action error" do
    assert {:error, :unknown_action} = PermissionRegistry.requirement("mutate.this_action_does_not_exist")
  end

  test "valid_rules? accepts normalized shape only" do
    normalized = %{
      "global" => %{"community.update" => true},
      "communities" => %{"javascript" => %{"post.edit" => true}}
    }

    assert PermissionRegistry.valid_rules?(normalized)
    refute PermissionRegistry.valid_rules?(%{"community.update" => true, "javascript" => %{"post.edit" => true}})
    refute PermissionRegistry.valid_rules?(%{"global" => %{"bad.perm" => true}, "communities" => %{}})
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

  defp valid_requirement?(%{owner_fallback: true} = requirement) when map_size(requirement) == 1,
    do: true

  defp valid_requirement?(%{scope: scope} = requirement)
       when scope in [:global, :thread, :community, :community_thread] do
    is_binary(requirement[:permission]) or is_binary(requirement[:permission_template])
  end

  defp valid_requirement?(_), do: false
end
