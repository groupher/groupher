defmodule GroupherServer.Test.Mutation.Account.Basic do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[account update]" do
    @update_query """
    mutation(
      $profile: UserProfileInput!,
      $social: SocialInput,
    ) {
      updateProfile(
        profile: $profile,
        social: $social,
      ) {
        id
        avatar
        nickname
        social {
          zhihu
          github
          blog
          twitter
          company
        }
      }
    }
    """
    test "user can update it's own profile", ~m(user)a do
      owned_conn = simu_conn(:user, user)

      variables = %{
        profile: %{
          avatar: "new avatar",
          nickname: "new nickname",
          bio: "everyday is the opportunity you don't get back,  so live life to the fullest",
          location: "china |> chengDu (成都).",
          sex: "dude"
        },
        social: %{
          zhihu: "xieyiming-75",
          github: "mydearxym",
          twitter: "fe2",
          blog: "hello",
          company: "world"
        }
      }

      updated = owned_conn |> gq_mutation(@update_query, variables)

      assert updated["avatar"] == "new avatar"
      assert updated["nickname"] == "new nickname"
      assert updated["social"]["zhihu"] == variables.social.zhihu
      assert updated["social"]["github"] == variables.social.github
      assert updated["social"]["twitter"] == variables.social.twitter
      assert updated["social"]["blog"] == variables.social.blog
      assert updated["social"]["company"] == variables.social.company
    end

    test "user's profile can not updated by guest", ~m(guest_conn)a do
      variables = %{
        profile: %{
          nickname: "new nickname"
        }
      }

      assert guest_conn |> mutation_error?(@update_query, variables, ecode(:account_login))
    end
  end
end
