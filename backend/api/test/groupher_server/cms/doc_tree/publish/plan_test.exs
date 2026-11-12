defmodule GroupherServer.CMS.DocTree.Publish.PlanTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.Plan

  defp tab(title \\ "Docs") do
    %{
      node_id: "tab",
      type: :tab,
      parent_node_id: nil,
      index: 0,
      title: title,
      href: nil,
      doc_id: nil,
      marker: nil,
      badge: nil,
      hidden: false
    }
  end

  defp upsert(node) do
    %{node_id: node.node_id, change_kind: :upsert, target: Map.delete(node, :node_id)}
  end

  defp page(id, doc_id, index) do
    %{tab(id) | node_id: id, type: :page, parent_node_id: "group", doc_id: doc_id, index: index}
  end

  defp group do
    %{tab("Group") | node_id: "group", type: :group, parent_node_id: "tab"}
  end

  test "first-release plan contains only structured facts" do
    assert {:ok, plan} = Plan.build(nil, [], [], [], [])
    assert Map.keys(plan) |> Enum.sort() == [:format_version, :payload, :target]

    assert plan.payload == %{
             "articles" => [],
             "base_release_id" => nil,
             "plan_format_version" => 1,
             "public_tree" => [],
             "tree_operations" => []
           }

    assert Plan.matches?(Plan.storage(plan.payload), plan)
  end

  test "member ordering, UUID case and no-op tree changes do not change structured facts" do
    node = tab()
    a = %{article_id: Ecto.UUID.generate(), working_copy_id: Ecto.UUID.generate(), revision: 1}
    b = %{article_id: Ecto.UUID.generate(), working_copy_id: Ecto.UUID.generate(), revision: 2}
    baseline = [node, group(), page("a", a.article_id, 0), page("b", b.article_id, 1)]
    public = [a.article_id, b.article_id]

    assert {:ok, first} = Plan.build(1, baseline, [], [a, b], public)

    assert {:ok, second} =
             Plan.build(
               1,
               baseline,
               [upsert(node)],
               [%{b | article_id: String.upcase(b.article_id)}, a],
               Enum.reverse(public)
             )

    assert first.payload == second.payload
    assert first.payload == second.payload
    assert {:ok, changed} = Plan.build(1, baseline, [], [a, %{b | revision: 3}], public)
    refute first.payload == changed.payload
    assert {:ok, changed} = Plan.build(2, baseline, [], [a, b], public)
    refute first.payload == changed.payload
    assert {:ok, changed} = Plan.build(1, baseline, [upsert(tab("Changed"))], [a, b], public)
    refute first.payload == changed.payload
  end

  test "rejects inconsistent initial baseline, duplicate members and noncanonical values" do
    assert {:error, :missing_public_release} = Plan.build(nil, [tab()], [], [], [])

    member = %{
      article_id: Ecto.UUID.generate(),
      working_copy_id: Ecto.UUID.generate(),
      revision: 1
    }

    assert {:error, :invalid_plan_members} = Plan.build(nil, [], [], [member, member], [])

    assert {:error, :invalid_plan_members} =
             Plan.build(nil, [], [], [%{member | revision: 0}], [])

    assert {:error, :invalid_plan_input} = Plan.build(9_223_372_036_854_775_808, [], [], [], [])
  end

  test "JSONB roundtrip preserves structural identity; fields and types cannot drift" do
    assert {:ok, plan} = Plan.build(1, [tab()], [upsert(tab("Updated"))], [], [])
    stored = plan.payload |> Jason.encode!() |> Jason.decode!()
    assert Plan.matches?(stored, plan)
    refute Plan.matches?(Map.put(stored, "extra", nil), plan)
    refute Plan.matches?(Map.put(stored, "base_release_id", 1.0), plan)

    refute Plan.matches?(
             put_in(stored, ["tree_operations", Access.at(0), "before", "title"], "Forged"),
             plan
           )

    refute Plan.matches?(
             put_in(stored, ["tree_operations", Access.at(0), "target", "href"], ""),
             plan
           )
  end

  test "rejects unknown input fields instead of silently discarding approved facts" do
    assert {:error, :invalid_plan_input} =
             Plan.build(1, [Map.put(tab(), :extra, true)], [], [], [])

    change = upsert(tab()) |> put_in([:target, :extra], true)
    assert {:error, :invalid_plan_input} = Plan.build(nil, [], [change], [], [])

    member = %{
      article_id: Ecto.UUID.generate(),
      working_copy_id: Ecto.UUID.generate(),
      revision: 1,
      extra: true
    }

    assert {:error, :invalid_plan_members} = Plan.build(nil, [], [], [member], [])

    assert {:error, :invalid_plan_members} =
             Plan.build(nil, [], [], [Map.delete(member, :extra) |> Map.put(:revision, 1.0)], [])
  end

  test "requires a queue member for each unpublished page and a page for each member" do
    id = Ecto.UUID.generate()
    work = Ecto.UUID.generate()
    member = %{article_id: id, working_copy_id: work, revision: 1}
    changes = Enum.map([tab(), group(), page("page", id, 0)], &upsert/1)

    assert {:error, {:unpublished_pages_without_content, [^id]}} =
             Plan.build(nil, [], changes, [], [])

    assert {:error, {:queued_articles_without_page, [^id]}} =
             Plan.build(nil, [], [], [member], [])

    assert {:ok, plan} = Plan.build(nil, [], changes, [member], [])
    assert Enum.any?(plan.target, &(&1.type == :page and &1.doc_id == id))
  end

  test "checks public heads against the release and public baseline" do
    id = Ecto.UUID.generate()
    baseline = [tab(), group(), page("page", id, 0)]

    assert {:error, :missing_public_release} = Plan.build(nil, [], [], [], [id])

    assert {:error, :public_tree_without_public_article} =
             Plan.build(1, baseline, [], [], [])

    assert {:error, :invalid_public_article_ids} =
             Plan.build(1, baseline, [], [], [id, String.upcase(id)])

    assert {:ok, _} = Plan.build(1, baseline, [], [], [id])
  end

  test "rejects a queued article for a page being removed but permits an unlisted public article" do
    id = Ecto.UUID.generate()
    member = %{article_id: id, working_copy_id: Ecto.UUID.generate(), revision: 1}
    baseline = [tab(), group(), page("page", id, 0)]
    removal = %{node_id: "page", change_kind: :delete, target: nil}

    assert {:error, {:removed_pages_with_queued_articles, [^id]}} =
             Plan.build(1, baseline, [removal], [member], [id])

    assert {:ok, _} = Plan.build(1, [tab(), group()], [], [member], [id])
  end
end
