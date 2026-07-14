defmodule GroupherServer.CMS.SearchArtiments.Artiment do
  @moduledoc """
  Canonical search projection shared by every search platform.

  Search identity is deliberately separate from the public ArticlePath or
  CommentPath stored in `locator`. Platform adapters may use `ref` as their
  object id, but callers must use `locator` for navigation and domain reads.
  """

  @type artiment_type :: :article | :comment
  @type thread :: :post | :blog | :changelog | :doc

  @type article_locator :: %{
          required(:community) => String.t(),
          required(:thread) => thread(),
          required(:inner_id) => String.t()
        }

  @type comment_locator :: %{
          required(:article) => article_locator(),
          required(:inner_id) => String.t(),
          optional(:root_inner_id) => String.t()
        }

  @type t :: %__MODULE__{
          ref: String.t(),
          type: artiment_type(),
          community_ref: String.t(),
          thread: thread(),
          article_ref: String.t(),
          title: String.t() | nil,
          plain_text: String.t(),
          plain_text_truncated: boolean(),
          digest: String.t() | nil,
          locator: article_locator() | comment_locator(),
          author_ref: String.t() | nil,
          locale: String.t() | nil,
          upvotes_count: non_neg_integer(),
          comments_count: non_neg_integer() | nil,
          replies_count: non_neg_integer() | nil,
          published_at: DateTime.t() | nil,
          inserted_at: DateTime.t(),
          updated_at: DateTime.t(),
          content_hash: String.t(),
          schema_version: pos_integer()
        }

  @enforce_keys [
    :ref,
    :type,
    :community_ref,
    :thread,
    :article_ref,
    :plain_text,
    :locator,
    :upvotes_count,
    :inserted_at,
    :updated_at,
    :content_hash,
    :schema_version
  ]

  defstruct @enforce_keys ++
              [
                :title,
                :digest,
                :author_ref,
                :locale,
                :comments_count,
                :replies_count,
                :published_at,
                plain_text_truncated: false
              ]

  @spec article_ref(thread(), Ecto.UUID.t()) :: String.t()
  def article_ref(thread, article_hash_id) do
    "ARTICLE:#{encode_thread(thread)}:#{article_hash_id}"
  end

  @spec comment_ref(thread(), Ecto.UUID.t(), non_neg_integer()) :: String.t()
  def comment_ref(thread, article_hash_id, comment_inner_id) do
    "COMMENT:#{encode_thread(thread)}:#{article_hash_id}:#{comment_inner_id}"
  end

  @doc "Serializes the canonical projection into the platform-neutral JSON shape."
  @spec to_platform_map(t()) :: map()
  def to_platform_map(%__MODULE__{} = artiment) do
    %{
      "objectID" => artiment.ref,
      "ref" => artiment.ref,
      "type" => encode_type(artiment.type),
      "communityRef" => artiment.community_ref,
      "thread" => encode_thread(artiment.thread),
      "articleRef" => artiment.article_ref,
      "title" => artiment.title,
      "plainText" => artiment.plain_text,
      "plainTextTruncated" => artiment.plain_text_truncated,
      "digest" => artiment.digest,
      "locator" => encode_locator(artiment.locator),
      "authorRef" => artiment.author_ref,
      "locale" => artiment.locale,
      "upvotesCount" => artiment.upvotes_count,
      "commentsCount" => artiment.comments_count,
      "repliesCount" => artiment.replies_count,
      "publishedAt" => encode_datetime(artiment.published_at),
      "insertedAt" => encode_datetime(artiment.inserted_at),
      "updatedAt" => encode_datetime(artiment.updated_at),
      "contentHash" => artiment.content_hash,
      "schemaVersion" => artiment.schema_version
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  @doc "Deserializes one platform hit back into the canonical projection."
  @spec from_platform_map(map()) :: {:ok, t()} | {:error, term()}
  def from_platform_map(attrs) when is_map(attrs) do
    with {:ok, type} <- decode_type(attrs["type"]),
         {:ok, thread} <- decode_thread(attrs["thread"]),
         {:ok, locator} <- decode_locator(type, attrs["locator"]),
         {:ok, inserted_at} <- decode_datetime(attrs["insertedAt"]),
         {:ok, updated_at} <- decode_datetime(attrs["updatedAt"]),
         {:ok, published_at} <- decode_optional_datetime(attrs["publishedAt"]) do
      {:ok,
       %__MODULE__{
         ref: attrs["ref"] || attrs["objectID"],
         type: type,
         community_ref: attrs["communityRef"],
         thread: thread,
         article_ref: attrs["articleRef"],
         title: attrs["title"],
         plain_text: attrs["plainText"] || "",
         plain_text_truncated: attrs["plainTextTruncated"] || false,
         digest: attrs["digest"],
         locator: locator,
         author_ref: attrs["authorRef"],
         locale: attrs["locale"],
         upvotes_count: attrs["upvotesCount"] || 0,
         comments_count: attrs["commentsCount"],
         replies_count: attrs["repliesCount"],
         published_at: published_at,
         inserted_at: inserted_at,
         updated_at: updated_at,
         content_hash: attrs["contentHash"],
         schema_version: attrs["schemaVersion"] || 1
       }}
    end
  rescue
    error in ArgumentError -> {:error, {:invalid_search_artiment, Exception.message(error)}}
  end

  defp encode_type(:article), do: "ARTICLE"
  defp encode_type(:comment), do: "COMMENT"

  defp decode_type("ARTICLE"), do: {:ok, :article}
  defp decode_type("COMMENT"), do: {:ok, :comment}
  defp decode_type(_), do: {:error, {:invalid_search_artiment, "invalid type"}}

  defp encode_thread(thread), do: thread |> Atom.to_string() |> String.upcase()

  defp decode_thread(value) when value in ~w(POST BLOG CHANGELOG DOC) do
    {:ok, value |> String.downcase() |> String.to_existing_atom()}
  end

  defp decode_thread(_), do: {:error, {:invalid_search_artiment, "invalid thread"}}

  defp encode_locator(%{article: article} = locator) do
    %{
      "article" => encode_locator(article),
      "innerId" => locator.inner_id,
      "rootInnerId" => Map.get(locator, :root_inner_id)
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end

  defp encode_locator(locator) do
    %{
      "community" => locator.community,
      "thread" => encode_thread(locator.thread),
      "innerId" => locator.inner_id
    }
  end

  defp decode_locator(:article, locator) when is_map(locator) do
    with {:ok, thread} <- decode_thread(locator["thread"]),
         community when is_binary(community) <- locator["community"],
         inner_id when is_binary(inner_id) <- locator["innerId"] do
      {:ok, %{community: community, thread: thread, inner_id: inner_id}}
    else
      _ -> {:error, {:invalid_search_artiment, "invalid article locator"}}
    end
  end

  defp decode_locator(:comment, %{"article" => article} = locator) do
    with {:ok, article_locator} <- decode_locator(:article, article),
         inner_id when is_binary(inner_id) <- locator["innerId"] do
      result = %{article: article_locator, inner_id: inner_id}

      case locator["rootInnerId"] do
        root_inner_id when is_binary(root_inner_id) ->
          {:ok, Map.put(result, :root_inner_id, root_inner_id)}

        _ ->
          {:ok, result}
      end
    else
      _ -> {:error, {:invalid_search_artiment, "invalid comment locator"}}
    end
  end

  defp decode_locator(_, _), do: {:error, {:invalid_search_artiment, "invalid locator"}}

  defp encode_datetime(nil), do: nil
  defp encode_datetime(%DateTime{} = datetime), do: DateTime.to_iso8601(datetime)

  defp decode_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> {:ok, datetime}
      _ -> {:error, {:invalid_search_artiment, "invalid datetime"}}
    end
  end

  defp decode_datetime(%DateTime{} = datetime), do: {:ok, datetime}
  defp decode_datetime(_), do: {:error, {:invalid_search_artiment, "missing datetime"}}

  defp decode_optional_datetime(nil), do: {:ok, nil}
  defp decode_optional_datetime(value), do: decode_datetime(value)
end
