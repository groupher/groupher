defmodule GroupherServerWeb.Middleware.GeneralErrorTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.Middleware.GQLResultFmt

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

  test "maps unstructured legacy values to a safe declared Web error" do
    result = GeneralError.call(%{errors: [{:legacy_failure, "details"}], value: nil}, [])

    assert result.errors == [
             %{
               message: "unexpected_error",
               extensions: %{code: WebErrorCat.code(WebErrorCat.unexpected_error())}
             }
           ]
  end

  test "formats every error separately and preserves an already formatted payload" do
    typed = CommunityErrorCat.active_application_exists()
    payload = %{message: "already formatted", extensions: %{code: 9000}}

    result =
      GeneralError.call(
        %{errors: [typed, "secret details", payload], value: nil},
        []
      )

    assert Enum.at(result.errors, 0).extensions.code == typed.code

    assert Enum.at(result.errors, 1).extensions.code ==
             WebErrorCat.code(WebErrorCat.unexpected_error())

    assert Enum.at(result.errors, 1).message == "unexpected_error"
    assert Enum.at(result.errors, 2) == payload
    refute inspect(result.errors) =~ "secret details"
  end

  test "GQLResultFmt validates each typed error in an errors array" do
    first = CommunityErrorCat.active_application_exists()
    second = CommunityErrorCat.application_not_found()

    result = GQLResultFmt.call(%{errors: [first, second], value: nil}, [])

    assert Enum.map(result.errors, & &1.extensions.code) == [first.code, second.code]
  end
end
