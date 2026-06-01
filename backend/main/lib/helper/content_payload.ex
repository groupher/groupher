defmodule Helper.ContentPayload do
  @moduledoc """
  Canonical content payload contract shared across pipeline and persistence.
  """

  @valid_fields [
    :json,
    :markdown,
    :markdown_toc,
    :html,
    :rss,
    :plain_text,
    :digest,
    :content_hash,
    :schema_version
  ]

  @type t :: %{
          json: String.t(),
          markdown: String.t(),
          markdown_toc: map(),
          html: String.t(),
          rss: String.t(),
          plain_text: String.t(),
          digest: String.t(),
          content_hash: String.t(),
          schema_version: integer(),
          ast: list(),
          mentions: list()
        }

  @doc """
  Picks only valid keys from a full content payload.

  ## Examples

      iex> payload = %{json: "[]", html: "<p>x</p>", mentions: ["Tom"], schema_version: 1}
      iex> Helper.ContentPayload.pick_valid_fields(payload)
      %{html: "<p>x</p>", json: "[]", schema_version: 1}
  """
  @spec pick_valid_fields(map()) :: map()
  def pick_valid_fields(payload) when is_map(payload),
    do: Map.take(payload, @valid_fields)
end
