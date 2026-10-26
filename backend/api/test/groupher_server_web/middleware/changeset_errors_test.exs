defmodule GroupherServerWeb.Middleware.ChangesetErrorsTest do
  use ExUnit.Case, async: true

  import Ecto.Changeset

  alias GroupherServer.ErrorCat
  alias GroupherServerWeb.Middleware.ChangesetErrors

  test "formats number validation errors with the original gettext template" do
    changeset =
      {%{age: nil}, %{age: :integer}}
      |> cast(%{age: 0}, [:age])
      |> validate_number(:age, greater_than: 10)

    result = ChangesetErrors.call(%Absinthe.Resolution{errors: [changeset]}, [])

    assert [
             %ErrorCat.Error{
               namespace: {:web},
               reason: :changeset,
               code: 4102,
               details: %{
                 message: [%{key: "age", message: "must be greater than 10"}]
               }
             }
           ] = result.errors
  end
end
