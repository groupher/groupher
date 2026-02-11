# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.GeneralError do
  @moduledoc """
  Fallback formatter for legacy non-domain/non-changeset errors.
  """

  @behaviour Absinthe.Middleware

  # legacy string errors
  def call(%{errors: [error]} = resolution, _) when is_binary(error) do
    %{resolution | value: [], errors: [%{message: error}]}
  end

  # legacy list errors (exclude graphql keyword shape)
  def call(%{errors: [error]} = resolution, _)
      when is_list(error) and not Keyword.keyword?(error) do
    %{resolution | value: [], errors: [%{message: error}]}
  end

  def call(resolution, _), do: resolution
end
