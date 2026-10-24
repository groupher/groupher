defmodule GroupherServerWeb.ErrorResponse do
  @moduledoc """
  Formats declared application errors for the GraphQL transport boundary.

  Domain Error or Gate Decision -> validated typed Absinthe error -> final formatter.
  Only the Pagi revision/API mismatch discriminator is exposed from details.
  """

  alias GroupherServer.{CMS, ErrorCat}
  alias ErrorCat.Error
  alias CMS.Gate.Decision
  alias GroupherServerWeb.Gettext, as: Translator

  @doc "Formats one declared ErrorCat error or denied Gate decision for GraphQL."
  @spec format_error(Error.t() | Decision.t()) :: {:error, keyword()}
  def format_error(%Decision{allowed: false, primary: primary}) do
    error = primary.error
    ensure_valid!(error)

    {:error,
     [
       message: translated(error),
       extensions: %{
         actions: Enum.map(primary.actions, &(&1 |> Atom.to_string() |> String.upcase())),
         code: error.code,
         retryable: primary.retryable
       }
     ]}
  end

  def format_error(%Error{} = error) do
    ensure_valid!(error)
    {:error, [message: error_message(error), extensions: domain_extensions(error)]}
  end

  def format_error(value) do
    raise ArgumentError,
          "declared ErrorCat.Error or denied Gate Decision is required, got: #{inspect(value)}"
  end

  @doc "Validates and writes one typed ErrorCat error or denied Gate decision to a resolution."
  @spec put_error(Absinthe.Resolution.t(), Error.t() | Decision.t()) :: Absinthe.Resolution.t()
  def put_error(resolution, %Error{} = error) do
    ensure_valid!(error)
    Absinthe.Resolution.put_result(resolution, {:error, error})
  end

  def put_error(
        resolution,
        %Decision{allowed: false, primary: %{error: %Error{} = error}} = decision
      ) do
    ensure_valid!(error)
    Absinthe.Resolution.put_result(resolution, {:error, decision})
  end

  def put_error(_resolution, value) do
    raise ArgumentError,
          "declared ErrorCat.Error or denied Gate Decision is required, got: #{inspect(value)}"
  end

  defp ensure_valid!(%Error{} = error) do
    unless ErrorCat.valid?(error) do
      raise ArgumentError, "invalid ErrorCat.Error at the GraphQL boundary: #{inspect(error)}"
    end
  end

  defp translated(%Error{message_key: key}) do
    Translator |> Gettext.dgettext("errors", key)
  end

  defp error_message(%Error{namespace: {:web}, reason: :changeset, details: %{message: message}})
       when is_list(message) do
    message
  end

  defp error_message(%Error{} = error) do
    {:error, [message: message, code: _code]} = ErrorCat.gq_format(error)
    message
  end

  defp domain_extensions(
         %Error{namespace: {:pagi}, reason: :config_mismatch, details: %{mismatch: mismatch}} =
           error
       )
       when mismatch in [:revision, :api] do
    %{code: error.code, mismatch: Atom.to_string(mismatch)}
  end

  defp domain_extensions(%Error{namespace: {:account, :authentication}, reason: reason} = error) do
    token_invalid = GroupherServer.Auth.contract_token_invalid()
    session_revoked = GroupherServer.Auth.contract_session_revoked()
    session_expired = GroupherServer.Auth.contract_session_expired()
    session_conflict = GroupherServer.Auth.contract_session_conflict()
    account_blocked = GroupherServer.Auth.contract_account_blocked()
    session_unavailable = GroupherServer.Auth.contract_session_unavailable()

    case reason do
      reason when reason in [:invalid_browser_access_claims, :invalid_legacy_access_claims] ->
        %{code: token_invalid}

      :session_revoked ->
        %{code: session_revoked}

      :session_not_found ->
        %{code: session_revoked}

      :session_expired ->
        %{code: session_expired}

      :current_session ->
        %{code: session_conflict}

      :account_blocked ->
        %{code: account_blocked}

      :session_unavailable ->
        %{code: session_unavailable}

      _ ->
        %{code: error.code}
    end
  end

  defp domain_extensions(%Error{code: code}), do: %{code: code}
end
