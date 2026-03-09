defmodule GroupherServer.Test.Query.Account.Customization do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Accounts.Model.Customization

  setup do
    {:ok, user} = db_insert(:user)
    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn user)a}
  end

  describe "[account customization]" do
    @query """
    query($login: String!) {
      user(login: $login) {
        id
        nickname
        customization {
          theme
          communityChart
          brainwashFree
          bannerLayout
          contentsLayout
          contentDivider
          markViewed
          displayDensity
        }
      }
    }
    """
    test "user can have default customization configs", ~m(user_conn user)a do
      results = user_conn |> gq_query(@query, %{login: user.login})

      assert results["id"] == to_string(user.id)
      assert results["customization"]["theme"] == Customization.default() |> Map.get(:theme)

      assert results["customization"]["bannerLayout"] ==
               Customization.default()
               |> Map.get(:banner_layout)

      assert results["customization"]["contentsLayout"] ==
               Customization.default() |> Map.get(:contents_layout)
    end
  end
end
