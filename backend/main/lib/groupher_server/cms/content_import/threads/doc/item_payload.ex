defmodule GroupherServer.CMS.ContentImport.Threads.Doc.ItemPayload do
  @moduledoc "Typed Doc item payload kept in a ContentImport Plan.Item."

  alias GroupherServer.CMS.ContentImport.Diagnostic

  @enforce_keys [:article_hash_id, :content]
  defstruct [:source_id, :source_path, :article_hash_id, :title, :slug, :route, :content]

  @type t :: %__MODULE__{
          source_id: String.t() | nil,
          source_path: String.t() | nil,
          article_hash_id: String.t(),
          title: String.t() | nil,
          slug: String.t() | nil,
          route: String.t() | nil,
          content: map()
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    article_hash_id = value(attrs, :article_hash_id, value(attrs, :articleHashId))
    content = value(attrs, :content)

    if is_binary(article_hash_id) and article_hash_id != "" and is_map(content) do
      {:ok,
       %__MODULE__{
         source_id: value(attrs, :source_id, value(attrs, :sourceId)),
         source_path: value(attrs, :source_path, value(attrs, :sourcePath)),
         article_hash_id: article_hash_id,
         title: value(attrs, :title),
         slug: value(attrs, :slug),
         route: value(attrs, :route),
         content: content
       }}
    else
      Diagnostic.error_result(
        "invalid_doc_item_payload",
        "Doc item payload requires articleHashId and content"
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
      "sourceId" => payload.source_id,
      "sourcePath" => payload.source_path,
      "articleHashId" => payload.article_hash_id,
      "title" => payload.title,
      "slug" => payload.slug,
      "route" => payload.route,
      "content" => payload.content
    }
  end

  @spec bounded_preview(t()) :: map()
  def bounded_preview(%__MODULE__{} = payload) do
    %{
      "title" => payload.title,
      "slug" => payload.slug,
      "route" => payload.route,
      "contentStatus" => payload.content["status"]
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp value(attrs, key, default \\ nil),
    do: Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
end
