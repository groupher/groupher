defmodule GroupherServer.Test.CMS.Passport.GlobalFactsGraphqlTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.GlobalPassport
  alias GroupherServerWeb.Schema

  @query "query { currentGlobalPassport { isRoot permissions } }"

  test "returns only the authenticated user's own global facts" do
    {:ok, alice} = db_insert(:user)
    {:ok, bob} = db_insert(:user)

    Repo.insert!(%GlobalPassport{
      user_id: alice.id,
      is_root: true,
      permissions: %{"community.application.review" => true}
    })

    assert {:ok,
            %{
              data: %{
                "currentGlobalPassport" => %{
                  "isRoot" => true,
                  "permissions" => ["COMMUNITY_APPLICATION_REVIEW"]
                }
              }
            }} =
             Absinthe.run(@query, Schema, context: %{cur_user: alice})

    assert {:ok, %{data: %{"currentGlobalPassport" => %{"isRoot" => false, "permissions" => []}}}} =
             Absinthe.run(@query, Schema, context: %{cur_user: bob})

    assert {:ok, %{errors: [_ | _]}} = Absinthe.run(@query, Schema)
  end
end
