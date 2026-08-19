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

  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.ErrorCat.Error
  alias GroupherServerWeb.Gettext, as: Translator

  def call(%{errors: [%Ecto.Changeset{}]} = resolution, _), do: resolution

  def call(%{errors: [%Decision{} = decision]} = resolution, _) do
    Absinthe.Resolution.put_result(resolution, graphql_error(decision))
  end

  def call(%{errors: [error]} = resolution, _) do
    if formattable_domain_error?(error) do
      {:error, [message: message, code: code]} =
        GroupherServer.ErrorCat.gq_format({:error, error})

      Absinthe.Resolution.put_result(
        resolution,
        {:error, [message: message, extensions: %{code: code}]}
      )
    else
      resolution
    end
  end

  def call(resolution, _), do: resolution

  @doc false
  @spec public_error(Decision.t()) :: %{
          required(:actions) => [String.t()],
          required(:code) => non_neg_integer(),
          required(:message) => String.t(),
          required(:retryable) => boolean()
        }
  def public_error(%Decision{allowed: false, primary: primary}) do
    error = primary.error

    %{
      actions: Enum.map(primary.actions, &(&1 |> Atom.to_string() |> String.upcase())),
      code: error.code,
      message: Translator |> Gettext.dgettext("errors", error.message_key),
      retryable: primary.retryable
    }
  end

  @doc false
  @spec graphql_error(Decision.t()) :: {:error, keyword()}
  def graphql_error(%Decision{} = decision) do
    %{actions: actions, code: code, message: message, retryable: retryable} =
      public_error(decision)

    {:error,
     [
       message: message,
       extensions: %{actions: actions, code: code, retryable: retryable}
     ]}
  end

  defp formattable_domain_error?(%Error{}), do: true

  defp formattable_domain_error?(reason) when is_list(reason) do
    Keyword.keyword?(reason) and Keyword.has_key?(reason, :message) and
      Keyword.has_key?(reason, :code)
  end

  defp formattable_domain_error?(_), do: false
end
