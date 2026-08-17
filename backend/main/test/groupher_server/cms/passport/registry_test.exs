defmodule GroupherServer.Test.CMS.Passport.Registry do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Passport.Registry

  test "can get all passport rules" do
    rules = Registry.all_passport_rules()

    assert Map.keys(rules) |> length == 3
    assert Map.keys(rules) |> Enum.sort() == [:god, :moderator, :root] |> Enum.sort()
    assert is_map(rules.god)
    assert is_map(rules.root)
    assert is_map(rules.moderator)
  end
end
