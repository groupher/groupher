# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.GQLResultFmt do
  @moduledoc """
  Convert domain-level error results into GraphQL error shape.

  Business position:

      Resolver result
        -> GQLResultFmt middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Gate.Decision
  alias GroupherServerWeb.ErrorResponse

  def call(%{errors: [%Ecto.Changeset{}]} = resolution, _), do: resolution

  def call(%{errors: errors} = resolution, _) when is_list(errors) and errors != [] do
    formatted =
      Enum.map(errors, fn
        %Decision{} = decision -> format(decision)
        %ErrorCat.Error{} = error -> format(error)
        other -> other
      end)

    %{resolution | value: [], errors: formatted}
  end

  def call(resolution, _), do: resolution

  defp format(error_or_decision) do
    {:error, payload} = ErrorResponse.format_error(error_or_decision)
    Map.new(payload)
  end
end
