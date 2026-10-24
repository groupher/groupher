# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.GeneralError do
  @moduledoc """
  Fallback formatter for legacy non-domain/non-changeset errors.

  Business position:

      Resolver result
        -> GeneralError middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware

  require Logger

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Gate.Decision
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.ErrorResponse

  def call(%{errors: errors} = resolution, _) when is_list(errors) and errors != [] do
    %{resolution | value: [], errors: Enum.map(errors, &format_error/1)}
  end

  def call(resolution, _), do: resolution

  defp format_error(%{message: message, extensions: extensions} = payload)
       when is_binary(message) and is_map(extensions) do
    payload
  end

  defp format_error(%ErrorCat.Error{} = error), do: format_declared(error)
  defp format_error(%Decision{} = decision), do: format_declared(decision)

  defp format_error(error) do
    Logger.warning("Unstructured GraphQL error reached GeneralError",
      error_type: inspect(if(is_map(error), do: Map.get(error, :__struct__), else: nil)),
      error: inspect(error, limit: 20, printable_limit: 200)
    )

    format_declared(WebErrorCat.unexpected_error())
  end

  defp format_declared(error) do
    {:error, formatted} = ErrorResponse.format_error(error)
    Map.new(formatted)
  end
end
