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
end
