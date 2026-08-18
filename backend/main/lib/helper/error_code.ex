defmodule Helper.ErrorCode do
  @moduledoc """
  Shared public error-code macros used by domains and GraphQL middleware.

  Business position:

      Domain or web caller
        -> ErrorCode
        -> normalized value / infrastructure
  """
  require Helper.Const

  @spec raise_error(atom(), String.t()) :: {:error, {atom(), String.t()}}
  @doc "Runs `raise_error` through the public `ErrorCode` boundary."
  def raise_error(code_atom, msg) do
    {:error, {code_atom, msg}}
  end

  @doc "Runs `ecode` through the public `ErrorCode` boundary."
  def ecode(reason) when is_atom(reason) do
    try do
      Helper.Const.error_code(reason)
    rescue
      Const.Error ->
        case System.get_env("MIX_ENV", "dev") do
          env when env in ["dev", "test"] ->
            raise ArgumentError, "unknown error reason: #{inspect(reason)}"

          _ ->
            Helper.Const.error_code(:custom)
        end
    end
  end

  def ecode, do: Helper.Const.default_error_code()
end
