defmodule GroupherServer.Test.CMS.Passport.GateActionContract do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.GateAction

  test "the generated Gate metadata matches every canonical permission" do
    contract =
      File.read!(Path.expand("../../../../../../packages/contracts/gate.contract.json", __DIR__))
      |> Jason.decode!()

    permissions = Map.new(contract["permissions"], &{&1["action"], &1})
    assert GateAction.actions() |> Enum.sort() == permissions |> Map.keys() |> Enum.sort()

    for {action, permission} <- permissions do
      assert GateAction.metadata(action) == %{
               scope: String.to_existing_atom(permission["scope"]),
               grantable: permission["grantable"],
               owner_only: permission["owner_only"],
               requires: permission["requires"],
               requires_thread: permission["requires_thread"]
             }
    end
  end
end
