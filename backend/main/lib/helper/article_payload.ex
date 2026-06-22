defmodule Helper.ArticlePayload do
  @moduledoc """
  Canonical article editor payload contract shared across parsing and persistence.
  """

  @valid_fields [
    :json,
    :markdown,
    :markdown_toc,
    :html,
    :xml,
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
          xml: String.t(),
          rss: String.t(),
          plain_text: String.t(),
          digest: String.t(),
          content_hash: String.t(),
          schema_version: integer(),
          ast: list(),
          mentions: list()
        }

  @doc """
  Picks only persistable article document fields from a full editor payload.

  ## Examples

      iex> payload = %{json: "[]", html: "<p>x</p>", mentions: ["Tom"], schema_version: 1}
      iex> Helper.ArticlePayload.pick_valid_fields(payload)
      %{html: "<p>x</p>", json: "[]", schema_version: 1}
  """
  @spec pick_valid_fields(map()) :: map()
  def pick_valid_fields(payload) when is_map(payload),
    do: Map.take(payload, @valid_fields)
end
