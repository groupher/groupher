defmodule GroupherServerWeb.Middleware.GeneralErrorTest do
  use ExUnit.Case, async: true

  alias GroupherServerWeb.Middleware.GeneralError

  test "formats a typed ErrorCat value" do
    error = GroupherServer.CMS.Communities.ErrorCat.active_application_exists()

    result = GeneralError.call(%{errors: [error], value: nil}, [])

    assert result.errors == [
             %{
               message: "active_application_exists",
               extensions: %{code: error.code}
             }
           ]
  end

  test "contains a legacy tuple without passing it to the strict ErrorCat encoder" do
    result = GeneralError.call(%{errors: [{:legacy_failure, "details"}], value: nil}, [])

    assert result.errors == [
             %{
               message: "Unexpected legacy domain error.",
               extensions: %{code: GroupherServer.ErrorCat.code(GroupherServer.ErrorCat.custom())}
             }
           ]
  end
end
