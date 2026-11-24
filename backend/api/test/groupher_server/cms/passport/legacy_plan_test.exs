defmodule GroupherServer.Test.CMS.Passport.LegacyPlanTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.Passport.LegacyPlan

  test "reports unsafe scoped conversions without widening thread grants" do
    rules = %{
      "global" => %{
        "god" => true,
        "community.create" => true,
        "system_notification.publish" => true
      },
      "alpha" => %{
        "root" => true,
        "cms" => %{"doc.queue.write" => true, "post.community_tag.set" => true}
      }
    }

    memberships = %{"alpha" => %{community_id: 7, member_id: 8}}

    assert {:ok, plan} = LegacyPlan.build(rules, memberships)
    assert plan.is_root
    assert plan.global == %{"community.create" => true}

    assert plan.communities["alpha"] == %{
             community_id: 7,
             member_id: 8,
             is_lord: true,
             permissions: %{"doc.queue.write" => true}
           }

    assert Enum.any?(plan.exceptions, &(&1.key == "system_notification.publish"))
    assert Enum.any?(plan.exceptions, &(&1.key == "alpha.post.community_tag.set"))
  end

  test "unknown communities, malformed values and non-membership remain explicit exceptions" do
    assert {:ok, plan} =
             LegacyPlan.build(
               %{"global" => %{"god" => "yes"}, "unknown" => %{"root" => true}},
               %{}
             )

    refute plan.is_root

    assert Enum.map(plan.exceptions, & &1.reason) |> Enum.sort() == [
             :invalid_boolean,
             :missing_or_ambiguous_membership
           ]
  end

  test "normalizes legacy global and cms wrapper without changing the planned scopes" do
    global = %{"god" => true, "community.create" => true}

    canonical = %{
      "global" => global,
      "alpha" => %{"cms" => %{"doc.queue.write" => true}}
    }

    legacy = %{
      "global" => global,
      "cms" => %{"alpha" => %{"doc.queue.write" => true}}
    }

    assert {:ok, canonical_rules} = LegacyPlan.normalize_legacy_rules(canonical)
    assert {:ok, legacy_rules} = LegacyPlan.normalize_legacy_rules(legacy)
    assert legacy_rules == canonical_rules

    membership = %{"alpha" => %{community_id: 7, member_id: 8}}
    assert {:ok, canonical_plan} = LegacyPlan.build(canonical_rules, membership)
    assert {:ok, legacy_plan} = LegacyPlan.build(legacy_rules, membership)
    assert legacy_plan == canonical_plan
    assert legacy_plan.is_root
    assert legacy_plan.global == %{"community.create" => true}
    assert legacy_plan.communities["alpha"].permissions == %{"doc.queue.write" => true}

    assert Enum.any?(legacy_plan.exceptions, fn exception ->
             exception.reason == :requires_semantic_review and
               exception.key == "alpha.doc.queue.write"
           end)
  end

  test "malformed legacy rule shapes and values fail closed" do
    assert {:ok, %{"global" => %{}}} = LegacyPlan.normalize_legacy_rules(nil)
    assert {:error, :invalid_legacy_rules} = LegacyPlan.normalize_legacy_rules(%{"alpha" => %{}})

    assert {:ok, malformed} =
             LegacyPlan.normalize_legacy_rules(%{
               "global" => %{"god" => "yes"},
               "cms" => "not-a-map"
             })

    assert {:ok, plan} = LegacyPlan.build(malformed, %{})
    assert plan.global == %{}
    refute plan.is_root
    assert Enum.any?(plan.exceptions, &(&1.reason == :invalid_boolean))
    assert Enum.any?(plan.exceptions, &(&1.reason == :invalid_community_scope))
  end
end
