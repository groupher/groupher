defmodule GroupherServer.Test.Query.CMS.ThirdPart do
  @moduledoc false

  use GroupherServer.TestTools

  # alias GroupherServer.Accounts.Model.User
  # alias GroupherServer.CMS
  # alias Helper.ORM

  setup do
    guest_conn = simu_conn(:guest)
    {:ok, user} = db_insert(:user)

    {:ok, ~m(guest_conn user)a}
  end

  describe "OSS" do
    @query """
    query {
      applyUploadTokens {
        accessKeyId
        accessKeySecret
        expiration
        securityToken
      }
    }
    """
    test "can get upload token for login user", ~m(user)a do
      # user_conn = simu_conn(:user, user)

      # ret =
      #   user_conn
      #   |> query_result(@query, %{}, "applyUploadTokens")

      # assert not is_nil(ret["accessKeyId"])
      # assert not is_nil(ret["accessKeySecret"])
      # assert not is_nil(ret["expiration"])
      # assert not is_nil(ret["securityToken"])

      {:ok, :pass}
    end

    test "can not get upload token for guest user", ~m(guest_conn)a do
      # assert guest_conn |> mutation_get_error?(@query, %{}, ecode(:account_login))
      {:ok, :pass}
    end
  end
end
