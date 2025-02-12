defmodule GroupherServer.Test.Accounts do
  use GroupherServer.TestTools
  # TODO import Service.Utils move both helper and github
  import Helper.Utils

  alias GroupherServer.Accounts

  alias Accounts.Model.User

  # @valid_user mock_attrs(:user)
  @valid_github_profile mock_attrs(:github_profile) |> map_key_stringify

  describe "[update user]" do
    test "update user with valid attrs" do
      {:ok, user} = db_insert(:user)

      attrs = %{
        nickname: "new nickname",
        sex: "dude",
        bio: "new bio",
        shortbio: "new shortbio",
        email: "new@qq.com"
      }

      {:ok, updated} = Accounts.update_profile(%User{id: user.id}, attrs)

      assert updated.bio == attrs.bio
      assert updated.nickname == attrs.nickname
      assert updated.shortbio == attrs.shortbio
      assert updated.sex == attrs.sex
    end

    test "update user social fields with valid attrs" do
      {:ok, user} = db_insert(:user)

      attrs = %{
        location: "new name",
        social: %{
          github: "github addr",
          blog: "my blog",
          company: "my company",
          twitter: "twitter addr"
        }
      }

      {:ok, updated} = Accounts.update_profile(%User{id: user.id}, attrs)

      assert updated.location == "new name"

      assert updated.social.github == attrs.social.github
      assert updated.social.twitter == attrs.social.twitter

      assert updated.social.company == attrs.social.company
      assert updated.social.blog == attrs.social.blog
    end
  end
end
