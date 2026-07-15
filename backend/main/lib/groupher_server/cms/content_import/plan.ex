defmodule GroupherServer.CMS.ContentImport.Plan do
  @moduledoc """
  Typed, side-effect-free projection returned by a ThreadAdapter.

      Snapshot + Diff + thread context
                     |
                     v
                   Plan
              /       |        \
             v        v         v
          Items      Assets    thread payload
             |        |         |
             +--------+---------+--> Preview projection
             |
             `---------------------> persisted Job children / final apply

  A Plan describes intended work; constructing or previewing it performs no
  database writes. Item and asset identities are unique before persistence.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Plan}
  alias GroupherServer.CMS.ContentImport.Plan.Payload

  @enforce_keys [:thread, :items, :assets, :payload]
  defstruct [:thread, :payload, items: [], assets: [], diagnostics: []]

  @type t :: %__MODULE__{
          thread: atom(),
          items: [Plan.Item.t()],
          assets: [Plan.Asset.t()],
          payload: Payload.plan_t(),
          diagnostics: [Diagnostic.t()]
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    with {:ok, thread} <- thread(attrs),
         {:ok, items} <- typed_list(attrs, :items, Plan.Item),
         {:ok, assets} <- typed_list(attrs, :assets, Plan.Asset),
         {:ok, payload} <- Payload.validate_plan(thread, value(attrs, :payload)),
         :ok <- Payload.validate_items(thread, items),
         {:ok, diagnostics} <- diagnostics(attrs),
         :ok <- unique_items(items),
         :ok <- unique_assets(assets) do
      {:ok,
       %__MODULE__{
         thread: thread,
         items: items,
         assets: assets,
         payload: payload,
         diagnostics: diagnostics
       }}
    end
  end

  def new(_attrs), do: Diagnostic.error_result("invalid_plan", "plan attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, plan} -> plan
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec ready_for_apply?(t()) :: boolean()
  def ready_for_apply?(%__MODULE__{assets: assets}),
    do: Enum.all?(assets, &Plan.Asset.terminal?/1)

  defp thread(attrs) do
    case value(attrs, :thread) do
      thread when is_atom(thread) and not is_nil(thread) -> {:ok, thread}
      _ -> Diagnostic.error_result("plan_thread_required", "plan thread must be an atom")
    end
  end

  defp typed_list(attrs, key, module) do
    case value(attrs, key, []) do
      values when is_list(values) ->
        if Enum.all?(values, &is_struct(&1, module)),
          do: {:ok, values},
          else: Diagnostic.error_result("invalid_plan_#{key}", "plan #{key} have invalid values")

      _ ->
        Diagnostic.error_result("invalid_plan_#{key}", "plan #{key} must be a list")
    end
  end

  defp diagnostics(attrs) do
    case value(attrs, :diagnostics, []) do
      diagnostics when is_list(diagnostics) -> {:ok, diagnostics}
      _ -> Diagnostic.error_result("invalid_plan_diagnostics", "plan diagnostics must be a list")
    end
  end

  defp unique_assets(assets) do
    keys = Enum.map(assets, & &1.asset_key)

    if length(keys) == MapSet.size(MapSet.new(keys)),
      do: :ok,
      else:
        Diagnostic.error_result(
          "duplicate_plan_asset_key",
          "plan asset_key values must be unique"
        )
  end

  defp unique_items(items) do
    external_refs = Enum.map(items, & &1.external_ref)
    target_refs = Enum.map(items, & &1.target_ref)

    cond do
      length(external_refs) != MapSet.size(MapSet.new(external_refs)) ->
        Diagnostic.error_result(
          "duplicate_plan_item_external_ref",
          "plan item external_ref values must be unique"
        )

      length(target_refs) != MapSet.size(MapSet.new(target_refs)) ->
        Diagnostic.error_result(
          "duplicate_plan_item_target_ref",
          "plan item target_ref values must be unique"
        )

      true ->
        :ok
    end
  end

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
