defmodule Helper.ErrorCode do
  @moduledoc """
  error code map for all site
  """
  require Helper.Const

  @spec raise_error(atom(), String.t()) :: {:error, {atom(), String.t()}}
  def raise_error(code_atom, msg) do
    {:error, {code_atom, msg}}
  end

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
