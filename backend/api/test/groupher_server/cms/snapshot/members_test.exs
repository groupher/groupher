defmodule GroupherServer.Test.CMS.Snapshot.MembersTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Snapshot.Members

  test "renaming an account never creates another participant identity" do
    old = %{id: 7, login: "old-login", nickname: "Old"}
    renamed = %{id: 7, login: "new-login", nickname: "New"}

    assert {:ok, [current, other]} =
             Members.promote([old, %{id: 8, login: "other"}], renamed, 4)

    assert current.id == 7
    assert current.login == "new-login"
    assert other.id == 8
  end

  test "bounded summaries preserve supplied fact order and normalize JSON maps" do
    users = for id <- 1..12, do: %{"user_id" => id, "login" => "user-#{id}"}
    assert {:ok, article} = Members.bounded(users, 10)
    assert {:ok, replies} = Members.bounded(users, 4)
    assert Enum.map(article, & &1.id) == Enum.to_list(1..10)
    assert Enum.map(replies, & &1.id) == [1, 2, 3, 4]
    assert {:ok, remaining} = Members.remove(replies, 2, 4)
    assert Enum.map(remaining, & &1.id) == [1, 3, 4]
  end

  test "a missing stable ID is an invariant error instead of login identity fallback" do
    assert {:error, :invalid_participant_snapshot} =
             Members.bounded([%{login: "no-id"}], 4)

    assert {:error, :invalid_participant_snapshot} = Members.bounded([], 0)
  end
end
