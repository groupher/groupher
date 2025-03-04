defmodule GroupherServer.Test.CMS.Passport do
  @moduledoc false
  use GroupherServer.TestTools

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS

  setup do
    {:ok, [user, user2]} = db_insert_multi(:user, 2)
    {:ok, ~m(user user2)a}
  end

  describe "[cms_passports]" do
    @valid_passport_rules %{
      "javascript" => %{
        "post.article.delete" => true,
        "post.tag.edit" => true
      }
    }
    @valid_passport_rules2 %{
      "javascript" => %{
        "post.article.update" => true,
        "post.tag.edit" => true
      }
    }
    test "can get all passport rules" do
      {:ok, rules} = CMS.all_passport_rules()

      assert Map.keys(rules) |> length == 2
      assert Map.keys(rules) |> Enum.sort() == [:moderator, :root] |> Enum.sort()
      assert is_map(rules.root)
      assert is_map(rules.moderator)
    end

    test "can insert valid nested passport structure", ~m(user)a do
      {:ok, passport} = CMS.stamp_passport(@valid_passport_rules, user)

      assert passport.user_id == user.id
      assert passport.rules |> get_in(["javascript", "post.article.delete"]) == true
      assert passport.rules |> get_in(["javascript", "post.tag.edit"]) == true
    end

    test "false rules will not be delete from current passport", ~m(user)a do
      {:ok, passport} = CMS.stamp_passport(@valid_passport_rules, user)

      assert passport.rules |> get_in(["javascript", "post.article.delete"]) == true
      assert passport.rules |> get_in(["javascript", "post.tag.edit"]) == true

      valid_passport2 = %{
        "javascript" => %{
          "post.tag.edit" => false
        }
      }

      {:ok, updated_passport} = CMS.stamp_passport(valid_passport2, user)

      assert updated_passport.user_id == user.id
      assert updated_passport.rules |> get_in(["javascript", "post.article.delete"]) == true
      assert updated_passport.rules |> get_in(["javascript", "post.tag.edit"]) == nil
    end

    test "get a user's passport", ~m(user)a do
      {:ok, _} = CMS.stamp_passport(@valid_passport_rules, user)
      {:ok, passport} = CMS.get_passport(user)

      assert passport |> Map.equal?(@valid_passport_rules)
    end

    test "get a normal user's passport fails", ~m(user)a do
      assert {:ok, %{}} = CMS.get_passport(user)
    end

    test "get a non-exist user's passport fails" do
      assert {:error, _} = CMS.get_passport(%User{id: non_exist_id()})
    end

    test "list passport by key", ~m(user user2)a do
      {:ok, _} = CMS.stamp_passport(@valid_passport_rules, user)
      {:ok, _} = CMS.stamp_passport(@valid_passport_rules2, user2)

      {:ok, passports} = CMS.paged_passports("javascript", "post.article.delete")

      assert length(passports) == 1
      assert passports |> List.first() |> Map.get(:rules) |> Map.equal?(@valid_passport_rules)
    end

    test "list passport by invalid key get []", ~m(user)a do
      {:ok, _} = CMS.stamp_passport(@valid_passport_rules, user)
      {:ok, []} = CMS.paged_passports("javascript", "non-exist")

      {:ok, []} = CMS.paged_passports("non-exist", "non-exist")
    end

    test "can ease a rule in passport", ~m(user)a do
      {:ok, passport} = CMS.stamp_passport(@valid_passport_rules, user)
      assert passport.rules |> get_in(["javascript", "post.article.delete"]) == true

      {:ok, passport_after} = CMS.erase_passport(["javascript", "post.article.delete"], user)

      assert nil == passport_after.rules |> get_in(["javascript", "post.article.delete"])
    end

    test "can ease a rule in passport by community slug", ~m(user)a do
      multi_rules = %{
        "javascript" => %{
          "post.article.delete" => true,
          "post.tag.edit" => true
        },
        "elixir" => %{
          "post.article.delete" => true,
          "post.tag.edit" => true
        }
      }

      {:ok, passport} = CMS.stamp_passport(multi_rules, user)
      assert passport.rules |> get_in(["javascript", "post.article.delete"]) == true

      {:ok, passport_after} = CMS.erase_passport(["javascript"], user)

      assert passport_after.rules == %{
               "elixir" => %{"post.article.delete" => true, "post.tag.edit" => true}
             }
    end

    test "erase a no-exist rule in passport is ok", ~m(user)a do
      {:ok, _} = CMS.stamp_passport(@valid_passport_rules, user)

      {:ok, _} = CMS.erase_passport(["javascript", "non-exist"], user)
      {:ok, _} = CMS.erase_passport(["non-exist", "post.article.delete"], user)
      {:ok, _} = CMS.erase_passport(["non-exist", "non-exist"], user)
    end
  end
end
