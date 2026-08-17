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
  alias GroupherServerWeb.Gettext, as: Translator

  def call(%{errors: [%Ecto.Changeset{}]} = resolution, _), do: resolution

  def call(%{errors: [%Decision{} = decision]} = resolution, _) do
    Absinthe.Resolution.put_result(resolution, graphql_error(decision))
  end

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

  @doc false
  @spec public_error(Decision.t()) :: %{
          required(:actions) => [String.t()],
          required(:code) => non_neg_integer(),
          required(:message) => String.t(),
          required(:retryable) => boolean()
        }
  def public_error(%Decision{allowed: false, primary: primary}) do
    %{
      actions: Enum.map(primary.actions, &(&1 |> Atom.to_string() |> String.upcase())),
      code: primary.err_code,
      message: Translator |> Gettext.dgettext("errors", message_key(primary.reason)),
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

  defp formattable_domain_error?(reason) when is_atom(reason), do: true
  defp formattable_domain_error?({reason, _meta}) when is_atom(reason), do: true

  defp formattable_domain_error?(reason) when is_list(reason) do
    Keyword.keyword?(reason) and Keyword.has_key?(reason, :message) and
      Keyword.has_key?(reason, :code)
  end

  defp formattable_domain_error?(_), do: false

  defp message_key(reason)
       when reason in [
              :ancestor_community_not_writable,
              :ancestor_article_archived,
              :article_archived
            ],
       do: "gate.read_only"

  defp message_key(reason)
       when reason in [
              :ancestor_article_deleted,
              :ancestor_article_destroyed,
              :article_deleted,
              :article_destroyed,
              :comment_deleted,
              :comment_destroyed,
              :resource_not_found
            ],
       do: "gate.unavailable"

  defp message_key(:permission_denied), do: "gate.permission_denied"
  defp message_key(:lifecycle_not_loaded), do: "gate.lifecycle_not_loaded"
  defp message_key(:doc_branch_required), do: "gate.doc_branch_required"
  defp message_key(:article_not_mutable), do: "gate.article_not_mutable"
  defp message_key(_reason), do: "gate.unknown"
end
