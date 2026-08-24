defmodule GroupherServer.Test.CMS.Passport.Assignment do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS.Passport.Assignment

  setup do
    {:ok, [user, user2]} = db_insert_multi(:user, 2)
    {:ok, ~m(user user2)a}
  end

  @valid_passport_rules %{
    "global" => %{},
    "javascript" => %{"cms" => %{"post.trash" => true, "post.edit" => true}}
  }
  @valid_passport_rules2 %{
    "global" => %{},
    "javascript" => %{"cms" => %{"post.pin" => true, "post.edit" => true}}
  }

  test "can insert valid nested passport structure", ~m(user)a do
    {:ok, passport} = Assignment.stamp_passport(@valid_passport_rules, user)

    assert passport.user_id == user.id
    assert passport.rules |> get_in(["javascript", "cms", "post.trash"]) == true
    assert passport.rules |> get_in(["javascript", "cms", "post.edit"]) == true
  end

  test "false rules will not be delete from current passport", ~m(user)a do
    {:ok, passport} = Assignment.stamp_passport(@valid_passport_rules, user)

    assert passport.rules |> get_in(["javascript", "cms", "post.trash"]) == true
    assert passport.rules |> get_in(["javascript", "cms", "post.edit"]) == true

    valid_passport2 = %{
      "global" => %{},
      "javascript" => %{"cms" => %{"post.edit" => false}}
    }

    {:ok, updated_passport} = Assignment.stamp_passport(valid_passport2, user)

    assert updated_passport.user_id == user.id
    assert updated_passport.rules |> get_in(["javascript", "cms", "post.trash"]) == true
    assert updated_passport.rules |> get_in(["javascript", "cms", "post.edit"]) == nil
  end

  test "get a user's passport", ~m(user)a do
    {:ok, _} = Assignment.stamp_passport(@valid_passport_rules, user)
    {:ok, passport} = Assignment.get_passport(user)

    assert passport |> Map.equal?(@valid_passport_rules)
  end

  test "get a normal user's passport fails", ~m(user)a do
    assert {:ok, %{"global" => %{}}} = Assignment.get_passport(user)
  end

  test "get a non-exist user's passport fails" do
    assert {:error, _} = Assignment.get_passport(%User{id: non_exist_id()})
  end

  test "list passport by key", ~m(user user2)a do
    {:ok, _} = Assignment.stamp_passport(@valid_passport_rules, user)
    {:ok, _} = Assignment.stamp_passport(@valid_passport_rules2, user2)

    {:ok, passports} = Assignment.paged_passports("javascript", "post.trash")

    assert length(passports) == 1
    assert passports |> List.first() |> Map.get(:rules) |> Map.equal?(@valid_passport_rules)
  end

  test "list passport by invalid key get []", ~m(user)a do
    {:ok, _} = Assignment.stamp_passport(@valid_passport_rules, user)
    {:ok, []} = Assignment.paged_passports("javascript", "non-exist")

    {:ok, []} = Assignment.paged_passports("non-exist", "non-exist")
  end

  test "can ease a rule in passport", ~m(user)a do
    {:ok, passport} = Assignment.stamp_passport(@valid_passport_rules, user)
    assert passport.rules |> get_in(["javascript", "cms", "post.trash"]) == true

    {:ok, passport_after} = Assignment.erase_passport(["javascript", "cms", "post.trash"], user)

    assert nil == passport_after.rules |> get_in(["javascript", "cms", "post.trash"])
  end

  test "can ease a rule in passport by community slug", ~m(user)a do
    multi_rules = %{
      "global" => %{},
      "javascript" => %{
        "cms" => %{
          "post.trash" => true,
          "post.edit" => true
        }
      },
      "elixir" => %{
        "cms" => %{
          "post.trash" => true,
          "post.edit" => true
        }
      }
    }

    {:ok, passport} = Assignment.stamp_passport(multi_rules, user)
    assert passport.rules |> get_in(["javascript", "cms", "post.trash"]) == true

    {:ok, passport_after} = Assignment.erase_passport(["javascript"], user)

    assert passport_after.rules == %{
             "global" => %{},
             "elixir" => %{"cms" => %{"post.trash" => true, "post.edit" => true}}
           }
  end

  test "erase a no-exist rule in passport is ok", ~m(user)a do
    {:ok, _} = Assignment.stamp_passport(@valid_passport_rules, user)

    {:ok, _} = Assignment.erase_passport(["javascript", "cms", "non-exist"], user)
    {:ok, _} = Assignment.erase_passport(["non-exist", "cms", "post.trash"], user)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_passport_shape}} =
             Assignment.erase_passport(["non-exist", "non-exist"], user)
  end
end
