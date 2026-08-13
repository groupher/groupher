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

  def call(%{errors: [%Ecto.Changeset{}]} = resolution, _), do: resolution

  def call(%{errors: [error]} = resolution, _) do
    if formattable_domain_error?(error) do
      {:error, [message: message, code: code]} = Helper.GQL.result({:error, error})

      Absinthe.Resolution.put_result(
        resolution,
        {:error, [message: message, extensions: %{code: code}]}
      )
    else
      resolution
    end
  end

  def call(resolution, _), do: resolution

  defp formattable_domain_error?(reason) when is_atom(reason), do: true
  defp formattable_domain_error?({reason, _meta}) when is_atom(reason), do: true

  defp formattable_domain_error?(reason) when is_list(reason) do
    Keyword.keyword?(reason) and Keyword.has_key?(reason, :message) and
      Keyword.has_key?(reason, :code)
  end

  defp formattable_domain_error?(_), do: false
end
