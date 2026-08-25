defmodule GroupherServer.Test.CMS.Communities.NamePolicyTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Communities.NamePolicy
  alias GroupherServer.CMS.Model.CommunitySlugClaim

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, %{user: user}}
  end

  test "reserved and normalized names are checked before namespace queries" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :reserved_slug}} =
             NamePolicy.check(" Home ")

    assert {:ok, "new-community"} = NamePolicy.check(" New-Community ")
  end

  test "disputed claims keep a name unavailable", %{user: user} do
    insert_claim!(user, "acme", :disputed)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :slug_disputed}} =
             NamePolicy.check("acme")

    assert {:ok, result} = CMS.Communities.check_name("acme")
    assert result.available == false
    assert result.reason_code == "slug_disputed"
  end

  test "cooldown claims block only while their cooldown is active", %{user: user} do
    insert_claim!(user, "cooldown-name", :cooldown,
      cooldown_until: DateTime.add(DateTime.utc_now(:second), 3600, :second)
    )

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :slug_in_cooldown}} =
             NamePolicy.check("cooldown-name")
  end

  defp insert_claim!(user, slug, status, attrs \\ []) do
    %CommunitySlugClaim{}
    |> CommunitySlugClaim.changeset(
      Map.merge(
        %{
          slug: slug,
          status: status,
          claimed_by_user_id: user.id,
          claim_reason: "name_policy_test"
        },
        Map.new(attrs)
      )
    )
    |> Repo.insert!()
  end
end
