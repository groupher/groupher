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

  alias GroupherServer.ErrorCat

  # legacy string errors
  def call(%{errors: [error]} = resolution, _) when is_binary(error) do
    %{resolution | value: [], errors: [%{message: error}]}
  end

  # legacy list errors (exclude graphql keyword shape)
  def call(%{errors: [error]} = resolution, _) when is_list(error) do
    if Keyword.keyword?(error) do
      resolution
    else
      %{resolution | value: [], errors: [%{message: error}]}
    end
  end

  # Legacy tuple errors are not part of the ErrorCat contract. Keep the
  # transport safe without guessing a domain code from their contents.
  def call(%{errors: [error]} = resolution, _) when is_tuple(error) do
    case ErrorCat.gq_format(ErrorCat.custom("Unexpected legacy domain error.")) do
      {:error, [message: message, code: code]} ->
        %{resolution | value: [], errors: [%{message: message, extensions: %{code: code}}]}

      _ ->
        resolution
    end
  end

  # typed ErrorCat domain errors
  def call(%{errors: [%ErrorCat.Error{} = error]} = resolution, _) do
    case ErrorCat.gq_format(error) do
      {:error, [message: message, code: code]} ->
        %{resolution | value: [], errors: [%{message: message, extensions: %{code: code}}]}

      _ ->
        resolution
    end
  end

  def call(resolution, _), do: resolution
end
