defmodule GroupherServerWeb.Middleware.GeneralErrorTest do
  use ExUnit.Case, async: true

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat

  alias GroupherServerWeb.Middleware.GeneralError

  test "formats a typed ErrorCat value" do
    error = CommunityErrorCat.active_application_exists()

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
               extensions: %{code: ErrorCat.code(ErrorCat.custom())}
             }
           ]
  end
end
