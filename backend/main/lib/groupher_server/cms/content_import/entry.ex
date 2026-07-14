defmodule GroupherServer.CMS.ContentImport.Entry do
  @moduledoc """
  Platform-neutral source content. Entry identity and revision belong to the
  upstream platform and never contain Groupher database identity.
  """

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic}

  @hash_version 1
  @normalization_version 1
  @kinds [:file, :record, :link, :asset]

  @enforce_keys [
    :external_ref,
    :kind,
    :content_hash,
    :hash_version,
    :normalization_version
  ]
  defstruct [
    :external_ref,
    :kind,
    :path,
    :title,
    :body,
    :body_format,
    :source_url,
    :source_updated_at,
    :revision,
    metadata: %{},
    content_hash: nil,
    hash_version: @hash_version,
    normalization_version: @normalization_version
  ]

  @type external_ref :: String.t()
  @type kind :: :file | :record | :link | :asset
  @type t :: %__MODULE__{
          external_ref: external_ref(),
          kind: kind(),
          path: String.t() | nil,
          title: String.t() | nil,
          body: binary() | map() | list() | nil,
          body_format: atom() | nil,
          metadata: map(),
          source_url: String.t() | nil,
          source_updated_at: DateTime.t() | nil,
          revision: String.t() | nil,
          content_hash: String.t(),
          hash_version: pos_integer(),
          normalization_version: pos_integer()
        }

  @spec hash_version() :: pos_integer()
  def hash_version, do: @hash_version

  @spec normalization_version() :: pos_integer()
  def normalization_version, do: @normalization_version

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    with {:ok, external_ref} <- required_string(attrs, :external_ref),
         {:ok, kind} <- kind(attrs),
         :ok <- validate_body(value(attrs, :body)),
         :ok <- validate_metadata(value(attrs, :metadata, %{})),
         :ok <- validate_source_updated_at(value(attrs, :source_updated_at)) do
      entry = %__MODULE__{
        external_ref: external_ref,
        kind: kind,
        path: value(attrs, :path),
        title: value(attrs, :title),
        body: value(attrs, :body),
        body_format: value(attrs, :body_format),
        metadata: value(attrs, :metadata, %{}),
        source_url: value(attrs, :source_url),
        source_updated_at: value(attrs, :source_updated_at),
        revision: value(attrs, :revision),
        content_hash: "",
        hash_version: @hash_version,
        normalization_version: @normalization_version
      }

      {:ok, %{entry | content_hash: content_hash(entry)}}
    end
  rescue
    error in ArgumentError ->
      Diagnostic.error_result("invalid_entry_content", Exception.message(error))
  end

  def new(_attrs), do: Diagnostic.error_result("invalid_entry", "entry attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, entry} -> entry
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec content_hash(t()) :: String.t()
  def content_hash(%__MODULE__{} = entry) do
    %{
      kind: Atom.to_string(entry.kind),
      path: Canonical.normalize_path(entry.path),
      title: entry.title,
      body: hash_body(entry.body, entry.kind),
      body_format: normalize_atom(entry.body_format),
      metadata: Canonical.effective_metadata(entry.metadata)
    }
    |> Canonical.sha256()
  end

  defp hash_body(body, :asset) when is_binary(body), do: {:raw_binary, body}
  defp hash_body(body, _kind) when is_binary(body), do: {:text_body, body}
  defp hash_body(body, _kind), do: body

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "entry_#{key}_required",
          "entry #{key} must be a non-empty string"
        )
    end
  end

  defp kind(attrs) do
    case value(attrs, :kind) do
      kind when kind in @kinds -> {:ok, kind}
      kind when is_binary(kind) -> parse_kind(kind)
      _ -> Diagnostic.error_result("invalid_entry_kind", "entry kind is not supported")
    end
  end

  defp parse_kind(kind) do
    case Enum.find(@kinds, &(Atom.to_string(&1) == kind)) do
      nil -> Diagnostic.error_result("invalid_entry_kind", "entry kind is not supported")
      parsed -> {:ok, parsed}
    end
  end

  defp validate_body(nil), do: :ok
  defp validate_body(body) when is_binary(body) or is_map(body) or is_list(body), do: :ok

  defp validate_body(_body),
    do: Diagnostic.error_result("invalid_entry_body", "entry body has an unsupported type")

  defp validate_metadata(metadata) when is_map(metadata), do: :ok

  defp validate_metadata(_metadata),
    do: Diagnostic.error_result("invalid_entry_metadata", "entry metadata must be a map")

  defp validate_source_updated_at(nil), do: :ok
  defp validate_source_updated_at(%DateTime{}), do: :ok

  defp validate_source_updated_at(_value),
    do:
      Diagnostic.error_result(
        "invalid_entry_source_updated_at",
        "entry source_updated_at must be a UTC DateTime"
      )

  defp normalize_atom(nil), do: nil
  defp normalize_atom(value) when is_atom(value), do: Atom.to_string(value)
  defp normalize_atom(value), do: value

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
