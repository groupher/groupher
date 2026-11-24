defmodule Helper.ORM.ConnectionConfig do
  @moduledoc """
  Normalizes database URL options that require typed Postgrex values.

      DATABASE_URL -> remove string channel_binding -> typed Repo option -> Postgrex

  Removing the query parameter prevents Ecto's URL options from overriding the
  typed option. Credentials and all other URL parameters remain in the URL.
  """

  @bindings %{"disable" => :disable, "prefer" => :prefer, "require" => :require}

  @doc """
  Returns a Repo URL and optional typed channel-binding policy, rejecting unsupported values.

  ## Examples

      iex> Helper.ORM.ConnectionConfig.from_url("ecto://localhost/example?channel_binding=require")
      {:ok, [url: "ecto://localhost/example", channel_binding: :require]}
  """
  @spec from_url(term()) :: {:ok, keyword()} | {:error, atom()}
  def from_url(url) when is_binary(url) do
    with {:ok, uri} <- URI.new(url),
         true <- is_binary(uri.host) do
      {bindings, remaining} =
        (uri.query || "")
        |> URI.query_decoder()
        |> Enum.split_with(fn {key, _value} -> key == "channel_binding" end)

      case bindings do
        [] ->
          {:ok, [url: url]}

        [{"channel_binding", value}] when is_map_key(@bindings, value) ->
          query = if remaining == [], do: nil, else: URI.encode_query(remaining)
          normalized_url = URI.to_string(%{uri | query: query})
          {:ok, [url: normalized_url, channel_binding: Map.fetch!(@bindings, value)]}

        _ ->
          {:error, :invalid_channel_binding}
      end
    else
      _ -> {:error, :invalid_database_url}
    end
  end

  def from_url(_), do: {:error, :invalid_database_url}
end
