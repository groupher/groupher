defmodule GroupherServer.CMS.ContentImport.ApplyResult do
  @moduledoc "Thread apply outcome used to persist source mappings after a successful write."

  alias GroupherServer.CMS.ContentImport.Diagnostic

  @type item_status :: :created | :updated | :skipped
  @type asset_status :: :created | :reused | :skipped
  @type item :: %{
          required(:external_ref) => String.t(),
          required(:target_ref) => String.t(),
          required(:status) => item_status()
        }
  @type asset :: %{
          required(:asset_key) => String.t(),
          required(:target_ref) => String.t(),
          required(:status) => asset_status()
        }

  @enforce_keys [:items, :assets]
  defstruct items: [], assets: [], diagnostics: []

  @type t :: %__MODULE__{
          items: [item()],
          assets: [asset()],
          diagnostics: [Diagnostic.t()]
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    items = value(attrs, :items, [])
    assets = value(attrs, :assets, [])
    diagnostics = value(attrs, :diagnostics, [])

    with :ok <- validate_items(items),
         :ok <- validate_assets(assets),
         :ok <- validate_diagnostics(diagnostics) do
      {:ok, %__MODULE__{items: items, assets: assets, diagnostics: diagnostics}}
    end
  end

  def new(_attrs),
    do: Diagnostic.error_result("invalid_apply_result", "apply result attributes must be a map")

  defp validate_items(items) when is_list(items) do
    if Enum.all?(items, &valid_item?/1),
      do: :ok,
      else: Diagnostic.error_result("invalid_apply_items", "apply result items are invalid")
  end

  defp validate_items(_items),
    do: Diagnostic.error_result("invalid_apply_items", "apply result items must be a list")

  defp validate_assets(assets) when is_list(assets) do
    if Enum.all?(assets, &valid_asset?/1),
      do: :ok,
      else: Diagnostic.error_result("invalid_apply_assets", "apply result assets are invalid")
  end

  defp validate_assets(_assets),
    do: Diagnostic.error_result("invalid_apply_assets", "apply result assets must be a list")

  defp validate_diagnostics(diagnostics) when is_list(diagnostics), do: :ok

  defp validate_diagnostics(_diagnostics),
    do:
      Diagnostic.error_result(
        "invalid_apply_diagnostics",
        "apply result diagnostics must be a list"
      )

  defp valid_item?(%{external_ref: external_ref, target_ref: target_ref, status: status}),
    do:
      non_empty?(external_ref) and non_empty?(target_ref) and
        status in [:created, :updated, :skipped]

  defp valid_item?(_item), do: false

  defp valid_asset?(%{asset_key: asset_key, target_ref: target_ref, status: status}),
    do:
      non_empty?(asset_key) and non_empty?(target_ref) and status in [:created, :reused, :skipped]

  defp valid_asset?(_asset), do: false

  defp non_empty?(value), do: is_binary(value) and value != ""

  defp value(attrs, key, default) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
