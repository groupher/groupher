defmodule GroupherServer.CMS.DocImport.Diagnostic do
  @moduledoc "Shared constructors for stable document-import diagnostics."

  def error(code, message, opts \\ []), do: build("error", code, message, opts)
  def warning(code, message, opts \\ []), do: build("warning", code, message, opts)
  def error_result(code, message, opts \\ []), do: {:error, error(code, message, opts)}

  defp build(severity, code, message, opts) do
    %{code: code, severity: severity, message: message}
    |> maybe_put(:file, opts[:file])
    |> maybe_put(:source_id, opts[:source_id])
    |> maybe_put(:details, opts[:details])
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)
end
