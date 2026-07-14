defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPayload do
  @moduledoc "Typed Changelog item payload kept in a ContentImport Plan.Item."

  alias GroupherServer.CMS.ContentImport.Diagnostic

  @enforce_keys [:content]
  defstruct [:title, :tag_name, :published_at, :prerelease, :source_url, :content]

  @type t :: %__MODULE__{
          title: String.t() | nil,
          tag_name: String.t() | nil,
          published_at: String.t() | nil,
          prerelease: boolean(),
          source_url: String.t() | nil,
          content: map()
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    content = value(attrs, :content)

    if is_map(content) do
      {:ok,
       %__MODULE__{
         title: value(attrs, :title),
         tag_name: value(attrs, :tag_name, value(attrs, :tagName)),
         published_at: value(attrs, :published_at, value(attrs, :publishedAt)),
         prerelease: value(attrs, :prerelease, false) == true,
         source_url: value(attrs, :source_url, value(attrs, :sourceUrl)),
         content: content
       }}
    else
      Diagnostic.error_result(
        "invalid_changelog_item_payload",
        "Changelog item payload requires content"
      )
    end
  end

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, payload} -> payload
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec encode(t()) :: map()
  def encode(%__MODULE__{} = payload) do
    %{
      "title" => payload.title,
      "tagName" => payload.tag_name,
      "publishedAt" => payload.published_at,
      "prerelease" => payload.prerelease,
      "sourceUrl" => payload.source_url,
      "content" => payload.content
    }
  end

  @spec bounded_preview(t()) :: map()
  def bounded_preview(%__MODULE__{} = payload) do
    %{
      "title" => payload.title,
      "tagName" => payload.tag_name,
      "publishedAt" => payload.published_at,
      "prerelease" => payload.prerelease,
      "contentStatus" => payload.content["status"]
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp value(attrs, key, default \\ nil),
    do: Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
end
