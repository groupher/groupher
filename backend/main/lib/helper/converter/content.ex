defmodule Helper.Converter.Content do
  @moduledoc """
  Canonical content converter entrypoint.
  """

  @type convert_result :: {:ok, map()} | {:error, term()}

  @callback convert(list()) :: convert_result()

  @spec convert(list()) :: convert_result()
  def convert(ast) when is_list(ast) do
    converter_provider().convert(ast)
  end

  def convert(_), do: {:error, :invalid_ast}

  defp converter_provider do
    case Application.get_env(:groupher_server, __MODULE__, []) |> Keyword.get(:provider) do
      nil ->
        raise """
        missing content converter provider for #{inspect(__MODULE__)}.
        Set config :groupher_server, #{inspect(__MODULE__)}, provider: <module>
        """

      provider ->
        provider
    end
  end
end
