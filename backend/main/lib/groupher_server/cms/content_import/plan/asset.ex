defmodule GroupherServer.CMS.ContentImport.Plan.Asset do
  @moduledoc "A resource dependency discovered by a ThreadAdapter and staged asynchronously."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry}

  @statuses [:pending, :staging, :ready, :failed]

  @enforce_keys [:asset_key, :source, :status]
  defstruct [
    :asset_key,
    :source,
    :source_path,
    :mime_type,
    :content_hash,
    :staging_ref,
    references: [],
    status: :pending
  ]

  @type source :: {:entry, Entry.external_ref()} | {:remote_url, String.t()}
  @type status :: :pending | :staging | :ready | :failed
  @type t :: %__MODULE__{
          asset_key: String.t(),
          source: source(),
          source_path: String.t() | nil,
          mime_type: String.t() | nil,
          content_hash: String.t() | nil,
          staging_ref: String.t() | nil,
          references: [map()],
          status: status()
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    with {:ok, asset_key} <- required_string(attrs, :asset_key),
         {:ok, source} <- source(attrs),
         {:ok, status} <- status(attrs),
         {:ok, references} <- references(attrs) do
      {:ok,
       %__MODULE__{
         asset_key: asset_key,
         source: source,
         source_path: value(attrs, :source_path),
         mime_type: value(attrs, :mime_type),
         content_hash: value(attrs, :content_hash),
         staging_ref: value(attrs, :staging_ref),
         references: references,
         status: status
       }}
    end
  end

  def new(_attrs),
    do: Diagnostic.error_result("invalid_plan_asset", "plan asset attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, asset} -> asset
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec transition(t(), status(), map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def transition(%__MODULE__{} = asset, next_status, attrs \\ %{}) when is_map(attrs) do
    if allowed_transition?(asset.status, next_status) do
      updated = %{
        asset
        | status: next_status,
          content_hash: value(attrs, :content_hash, asset.content_hash),
          staging_ref: value(attrs, :staging_ref, asset.staging_ref),
          mime_type: value(attrs, :mime_type, asset.mime_type)
      }

      validate_terminal(updated)
    else
      Diagnostic.error_result(
        "invalid_plan_asset_transition",
        "cannot transition plan asset from #{asset.status} to #{next_status}"
      )
    end
  end

  @spec terminal?(t()) :: boolean()
  def terminal?(%__MODULE__{status: status}), do: status in [:ready, :failed]

  defp allowed_transition?(:pending, :staging), do: true
  defp allowed_transition?(:staging, status) when status in [:ready, :failed], do: true
  defp allowed_transition?(:failed, :staging), do: true
  defp allowed_transition?(_current, _next), do: false

  defp validate_terminal(
         %__MODULE__{status: :ready, content_hash: hash, staging_ref: ref} = asset
       )
       when is_binary(hash) and hash != "" and is_binary(ref) and ref != "",
       do: {:ok, asset}

  defp validate_terminal(%__MODULE__{status: :ready}) do
    Diagnostic.error_result(
      "incomplete_ready_plan_asset",
      "ready plan assets require content_hash and staging_ref"
    )
  end

  defp validate_terminal(%__MODULE__{} = asset), do: {:ok, asset}

  defp source(attrs) do
    case value(attrs, :source) do
      {:entry, external_ref} when is_binary(external_ref) and external_ref != "" ->
        {:ok, {:entry, external_ref}}

      {:remote_url, url} when is_binary(url) and url != "" ->
        {:ok, {:remote_url, url}}

      _ ->
        Diagnostic.error_result(
          "invalid_plan_asset_source",
          "plan asset source must reference an Entry external_ref or remote URL"
        )
    end
  end

  defp status(attrs) do
    case value(attrs, :status, :pending) do
      status when status in @statuses ->
        {:ok, status}

      _ ->
        Diagnostic.error_result("invalid_plan_asset_status", "plan asset status is not supported")
    end
  end

  defp references(attrs) do
    case value(attrs, :references, []) do
      references when is_list(references) ->
        if Enum.all?(references, &is_map/1),
          do: {:ok, references},
          else:
            Diagnostic.error_result(
              "invalid_plan_asset_references",
              "plan asset references must contain maps"
            )

      _ ->
        Diagnostic.error_result(
          "invalid_plan_asset_references",
          "plan asset references must be a list"
        )
    end
  end

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "plan_asset_#{key}_required",
          "plan asset #{key} must be a non-empty string"
        )
    end
  end

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
