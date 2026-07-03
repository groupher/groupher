defmodule GroupherServer.Test.CMS.Models.Embeds.UserTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Embeds.User

  describe "normalize/1" do
    test "normalizes atom-key maps" do
      user =
        User.normalize(%{
          id: 1,
          user_id: 2,
          login: "alice",
          nickname: "Alice",
          avatar: "avatar.png"
        })

      assert user.id == 1
      assert user.user_id == 2
      assert user.login == "alice"
      assert user.nickname == "Alice"
      assert user.avatar == "avatar.png"
    end

    test "does not read string-key maps" do
      user =
        User.normalize(%{
          "id" => 1,
          "user_id" => 2,
          "login" => "alice",
          "nickname" => "Alice",
          "avatar" => "avatar.png"
        })

      refute User.valid?(user)
      assert user.id == nil
      assert user.user_id == nil
      assert user.login == nil
    end
  end
end
