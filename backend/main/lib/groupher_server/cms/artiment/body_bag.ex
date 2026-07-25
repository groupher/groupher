defmodule GroupherServer.CMS.Artiment.BodyBag do
  @moduledoc """
  Validates the canonical body bundle produced by the Node artiment publisher.

  This contract deliberately does not derive Markdown, HTML, TOC, plain text,
  or hashes. It only enforces the inexpensive trust-boundary checks that remain
  the Elixir application's responsibility before persistence.

      Node publisher
           |
           v
      BodyBag.cast
           |
           +-- schema / size / Plate-shape validation
           |
           v
      typed BodyBag -> Draft / Snapshot / ContentImport Writer

  See `docs/bulk-import/article-publish-import-refactor.md` for the shared publisher boundary.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS.Model.ArticleDocument

  @primary_key false

  @schema_version 2
  @supported_schema_versions [1, @schema_version]
  @max_json_bytes 2 * 1024 * 1024
  @max_derived_bytes 2 * 1024 * 1024
  @max_total_bytes 6 * 1024 * 1024
  @max_node_count 20_000
  @max_depth 64
  @max_toc_items 500
  @max_digest_length 500
  @min_plain_text_length get_config(:article, :min_length)
  @max_plain_text_length get_config(:article, :max_length)
  @empty_doc_attrs %{
    json: ~S([{"children":[{"text":""}],"type":"p"}]),
    markdown: "\u200B\n",
    html:
      "<div class=\"slate-editor\"><div class=\"slate-p m-0 px-0 py-1\"><span><span><span>\uFEFF</span></span></span></div></div>",
    toc: [],
    plain_text: "",
    digest: "",
    body_hash: "b57d3e9ff51a3f143580177c53e096767fa8cd8047d0cb3b8c59722e9e714f79",
    schema_version: @schema_version
  }

  @fields ~w(json markdown html toc plain_text digest body_hash schema_version)a
  @string_fields ~w(json markdown html plain_text digest body_hash)a
  @camel_atoms %{
    "plainText" => :plainText,
    "bodyHash" => :bodyHash,
    "schemaVersion" => :schemaVersion
  }

  embedded_schema do
    field(:json, :string)
    field(:markdown, :string)
    field(:html, :string)
    field(:toc, {:array, :map}, default: [])
    field(:plain_text, :string)
    field(:digest, :string)
    field(:body_hash, :string)
    field(:schema_version, :integer)
  end

  @type t :: %__MODULE__{
          json: String.t(),
          markdown: String.t(),
          html: String.t(),
          toc: [map()],
          plain_text: String.t(),
          digest: String.t(),
          body_hash: String.t(),
          schema_version: pos_integer()
        }

  @doc "Returns the BodyBag schema version accepted by this service."
  @spec schema_version() :: pos_integer()
  def schema_version, do: @schema_version

  @doc """
  Returns the canonical empty Docs BodyBag produced by the Node publisher.

  This is the neutral initial editor document, not a product template. Keep the
  derived fields and hash aligned with `publishArtiment([{type: "p", children:
  [%{text: ""}]}])` whenever the rich-editor schema changes.
  """
  @spec empty_doc() :: map()
  def empty_doc, do: @empty_doc_attrs

  @doc "Casts and validates one GraphQL/JSON BodyBag payload."
  @spec cast(t() | map(), keyword()) :: {:ok, t()} | {:error, Ecto.Changeset.t()}
  def cast(attrs, options \\ [])

  def cast(%__MODULE__{} = body_bag, options), do: cast(Map.from_struct(body_bag), options)

  def cast(attrs, options) when is_map(attrs) do
    attrs = normalize_attrs(attrs)
    min_plain_text_length = min_plain_text_length(options)
    required_string_fields = required_string_fields(options)

    %__MODULE__{}
    |> cast_fields(attrs, options)
    |> require_input_keys(attrs)
    |> validate_required(required_string_fields ++ [:schema_version])
    |> validate_inclusion(:schema_version, @supported_schema_versions)
    |> validate_format(:body_hash, ~r/\A[0-9a-f]{64}\z/)
    |> validate_length(:plain_text,
      min: min_plain_text_length,
      max: @max_plain_text_length
    )
    |> validate_change(:plain_text, &validate_plain_text(&1, &2, options))
    |> validate_length(:digest, max: @max_digest_length)
    |> validate_length(:toc, max: @max_toc_items)
    |> validate_change(:json, &validate_json/2)
    |> validate_change(:markdown, &validate_derived_size/2)
    |> validate_change(:html, &validate_derived_size/2)
    |> validate_total_size()
    |> apply_body_bag()
  end

  def cast(_attrs, options) do
    cast(%{}, options)
  end

  @doc "Builds a validated BodyBag from an already-persisted ArticleDocument."
  @spec from_document(ArticleDocument.t()) :: {:ok, t()} | {:error, Ecto.Changeset.t()}
  def from_document(%ArticleDocument{} = document) do
    document
    |> from_document_map()
    |> cast(thread: document.thread)
  end

  @doc "Projects persisted document fields into the BodyBag input shape."
  @spec from_document_map(ArticleDocument.t()) :: map()
  def from_document_map(%ArticleDocument{} = document) do
    %{
      json: document.json,
      markdown: document.markdown,
      html: document.html,
      toc: document_toc(document.markdown_toc),
      plain_text: document.plain_text,
      digest: document.digest,
      body_hash: document.body_hash,
      schema_version: document.schema_version
    }
  end

  @doc "Returns ArticleDocument persistence attributes without regenerating content."
  @spec to_document_attrs(t()) :: map()
  def to_document_attrs(%__MODULE__{} = body_bag) do
    %{
      json: body_bag.json,
      markdown: body_bag.markdown,
      markdown_toc: %{items: body_bag.toc},
      html: body_bag.html,
      plain_text: body_bag.plain_text,
      digest: body_bag.digest,
      body_hash: body_bag.body_hash,
      schema_version: body_bag.schema_version,
      xml: nil,
      rss: nil
    }
  end

  @doc "Returns a JSON-safe map suitable for immutable Snapshot storage."
  @spec to_map(t()) :: map()
  def to_map(%__MODULE__{} = body_bag), do: Map.from_struct(body_bag)

  defp normalize_attrs(attrs) do
    %{
      json: value(attrs, :json),
      markdown: value(attrs, :markdown),
      html: value(attrs, :html),
      toc: value(attrs, :toc),
      plain_text: value(attrs, :plain_text, "plainText"),
      digest: value(attrs, :digest),
      body_hash: value(attrs, :body_hash, "bodyHash"),
      schema_version: value(attrs, :schema_version, "schemaVersion")
    }
  end

  defp value(attrs, key, camel_key \\ nil) do
    Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key)) ||
      (camel_key && (Map.get(attrs, camel_key) || Map.get(attrs, @camel_atoms[camel_key])))
  end

  defp require_input_keys(changeset, attrs) do
    Enum.reduce(@fields, changeset, fn field, acc ->
      if Map.get(attrs, field) == nil, do: add_error(acc, field, "is required"), else: acc
    end)
  end

  defp validate_json(:json, json) when byte_size(json) > @max_json_bytes,
    do: [json: "exceeds the #{@max_json_bytes} byte limit"]

  defp validate_json(:json, json) do
    case Jason.decode(json) do
      {:ok, value} when is_list(value) -> validate_structure(value)
      {:ok, _value} -> [json: "must contain a Plate root list"]
      {:error, _reason} -> [json: "must be valid JSON"]
    end
  end

  defp validate_structure(root) do
    case walk([{root, 0}], 0) do
      {:ok, _count} -> []
      {:error, message} -> [json: message]
    end
  end

  defp walk([], count), do: {:ok, count}

  defp walk([{_value, depth} | _rest], _count) when depth > @max_depth,
    do: {:error, "exceeds the maximum depth of #{@max_depth}"}

  defp walk([{value, depth} | rest], count) when is_list(value) do
    walk(Enum.map(value, &{&1, depth + 1}) ++ rest, count)
  end

  defp walk([{value, depth} | rest], count) when is_map(value) do
    count =
      if Map.has_key?(value, "type") or Map.has_key?(value, "text"), do: count + 1, else: count

    if count > @max_node_count do
      {:error, "exceeds the maximum node count of #{@max_node_count}"}
    else
      walk(Enum.map(Map.values(value), &{&1, depth + 1}) ++ rest, count)
    end
  end

  defp walk([_value | rest], count), do: walk(rest, count)

  defp validate_derived_size(field, value) when byte_size(value) > @max_derived_bytes,
    do: [{field, "exceeds the #{@max_derived_bytes} byte limit"}]

  defp validate_derived_size(_field, _value), do: []

  defp validate_plain_text(:plain_text, "", options) do
    if Keyword.get(options, :thread) == :doc, do: [], else: [plain_text: "can't be blank"]
  end

  defp validate_plain_text(:plain_text, value, _options) do
    if String.trim(value) == "", do: [plain_text: "can't be blank"], else: []
  end

  defp min_plain_text_length(options) do
    if Keyword.get(options, :thread) == :doc, do: 0, else: @min_plain_text_length
  end

  defp required_string_fields(options) do
    if Keyword.get(options, :thread) == :doc,
      do: @string_fields -- [:plain_text, :digest],
      else: @string_fields
  end

  # Ecto normally treats empty strings as absent input. An empty Docs document
  # is a valid publisher result, so preserve its exact plain_text/digest values.
  defp cast_fields(body_bag, attrs, options) do
    if Keyword.get(options, :thread) == :doc,
      do: Ecto.Changeset.cast(body_bag, attrs, @fields, empty_values: []),
      else: Ecto.Changeset.cast(body_bag, attrs, @fields)
  end

  defp validate_total_size(changeset) do
    total =
      Enum.reduce(@string_fields, 0, fn field, size ->
        case get_field(changeset, field) do
          value when is_binary(value) -> size + byte_size(value)
          _ -> size
        end
      end)

    if total > @max_total_bytes,
      do: add_error(changeset, :json, "BodyBag exceeds the #{@max_total_bytes} byte limit"),
      else: changeset
  end

  defp apply_body_bag(%Ecto.Changeset{valid?: true} = changeset),
    do: {:ok, apply_changes(changeset)}

  defp apply_body_bag(changeset), do: {:error, changeset}

  defp document_toc(%{"items" => items}) when is_list(items), do: items
  defp document_toc(%{items: items}) when is_list(items), do: items
  defp document_toc(items) when is_list(items), do: items
  defp document_toc(_toc), do: []
end
