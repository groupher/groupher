defmodule GroupherServer.CMS.ContentImport.Diagnostic do
  @moduledoc "Shared constructors for stable content-import diagnostics."

  @type severity :: :error | :warning
  @type t :: %{
          required(:code) => String.t(),
          required(:severity) => String.t(),
          required(:message) => String.t(),
          optional(:file) => String.t(),
          optional(:source_id) => String.t(),
          optional(:details) => term()
        }

  @spec error(String.t(), String.t(), keyword()) :: t()
  def error(code, message, opts \\ []), do: build(:error, code, message, opts)

  @spec warning(String.t(), String.t(), keyword()) :: t()
  def warning(code, message, opts \\ []), do: build(:warning, code, message, opts)

  @spec error_result(String.t(), String.t(), keyword()) :: {:error, t()}
  def error_result(code, message, opts \\ []), do: {:error, error(code, message, opts)}

  defp build(severity, code, message, opts) do
    %{code: code, severity: Atom.to_string(severity), message: message}
    |> maybe_put(:file, opts[:file])
    |> maybe_put(:source_id, opts[:source_id])
    |> maybe_put(:details, opts[:details])
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
