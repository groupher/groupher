defmodule GroupherServer.Test.CMS.Communities.Passport do
  @moduledoc false
  use GroupherServer.TestMate

  alias CMS.Communities.Passport

  setup do
    {:ok, [user, user2]} = db_insert_multi(:user, 2)
    {:ok, ~m(user user2)a}
  end

  describe "[cms_passports]" do
    @valid_passport_rules %{
      "global" => %{},
      "cms" => %{"javascript" => %{"post.delete" => true, "post.edit" => true}}
    }
    @valid_passport_rules2 %{
      "global" => %{},
      "cms" => %{"javascript" => %{"post.pin" => true, "post.edit" => true}}
    }
    test "can get all passport rules" do
      {:ok, rules} = Passport.all_passport_rules()

      assert Map.keys(rules) |> length == 2
      assert Map.keys(rules) |> Enum.sort() == [:moderator, :root] |> Enum.sort()
      assert is_map(rules.root)
      assert is_map(rules.moderator)
    end

    test "can insert valid nested passport structure", ~m(user)a do
      {:ok, passport} = Passport.stamp_passport(@valid_passport_rules, user)

      assert passport.user_id == user.id
      assert passport.rules |> get_in(["cms", "javascript", "post.delete"]) == true
      assert passport.rules |> get_in(["cms", "javascript", "post.edit"]) == true
    end

    test "false rules will not be delete from current passport", ~m(user)a do
      {:ok, passport} = Passport.stamp_passport(@valid_passport_rules, user)

      assert passport.rules |> get_in(["cms", "javascript", "post.delete"]) == true
      assert passport.rules |> get_in(["cms", "javascript", "post.edit"]) == true

      valid_passport2 = %{
        "global" => %{},
        "cms" => %{"javascript" => %{"post.edit" => false}}
      }

      {:ok, updated_passport} = Passport.stamp_passport(valid_passport2, user)

      assert updated_passport.user_id == user.id
      assert updated_passport.rules |> get_in(["cms", "javascript", "post.delete"]) == true
      assert updated_passport.rules |> get_in(["cms", "javascript", "post.edit"]) == nil
    end

    test "get a user's passport", ~m(user)a do
      {:ok, _} = Passport.stamp_passport(@valid_passport_rules, user)
      {:ok, passport} = Passport.get_passport(user)

      assert passport |> Map.equal?(@valid_passport_rules)
    end

    test "get a normal user's passport fails", ~m(user)a do
      assert {:ok, %{"global" => %{}, "cms" => %{}}} = Passport.get_passport(user)
    end

    test "get a non-exist user's passport fails" do
      assert {:error, _} = Passport.get_passport(%User{id: non_exist_id()})
    end

    test "list passport by key", ~m(user user2)a do
      {:ok, _} = Passport.stamp_passport(@valid_passport_rules, user)
      {:ok, _} = Passport.stamp_passport(@valid_passport_rules2, user2)

      {:ok, passports} = Passport.paged_passports("javascript", "post.delete")

      assert length(passports) == 1
      assert passports |> List.first() |> Map.get(:rules) |> Map.equal?(@valid_passport_rules)
    end

    test "list passport by invalid key get []", ~m(user)a do
      {:ok, _} = Passport.stamp_passport(@valid_passport_rules, user)
      {:ok, []} = Passport.paged_passports("javascript", "non-exist")

      {:ok, []} = Passport.paged_passports("non-exist", "non-exist")
    end

    test "can ease a rule in passport", ~m(user)a do
      {:ok, passport} = Passport.stamp_passport(@valid_passport_rules, user)
      assert passport.rules |> get_in(["cms", "javascript", "post.delete"]) == true

      {:ok, passport_after} = Passport.erase_passport(["cms", "javascript", "post.delete"], user)

      assert nil == passport_after.rules |> get_in(["cms", "javascript", "post.delete"])
    end

    test "can ease a rule in passport by community slug", ~m(user)a do
      multi_rules = %{
        "global" => %{},
        "cms" => %{
          "javascript" => %{
            "post.delete" => true,
            "post.edit" => true
          },
          "elixir" => %{
            "post.delete" => true,
            "post.edit" => true
          }
        }
      }

      {:ok, passport} = Passport.stamp_passport(multi_rules, user)
      assert passport.rules |> get_in(["cms", "javascript", "post.delete"]) == true

      {:ok, passport_after} = Passport.erase_passport(["cms", "javascript"], user)

      assert passport_after.rules == %{
               "global" => %{},
               "cms" => %{"elixir" => %{"post.delete" => true, "post.edit" => true}}
             }
    end

    test "erase a no-exist rule in passport is ok", ~m(user)a do
      {:ok, _} = Passport.stamp_passport(@valid_passport_rules, user)

      {:ok, _} = Passport.erase_passport(["cms", "javascript", "non-exist"], user)
      {:ok, _} = Passport.erase_passport(["cms", "non-exist", "post.delete"], user)

      assert {:error, :invalid_passport_shape} =
               Passport.erase_passport(["non-exist", "non-exist"], user)
    end
  end
end
