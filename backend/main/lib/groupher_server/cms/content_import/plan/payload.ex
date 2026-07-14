defmodule GroupherServer.CMS.ContentImport.Plan.Payload do
  @moduledoc "Registry and codec boundary for thread-specific Plan payload structs."

  alias GroupherServer.CMS.ContentImport.Diagnostic
  alias GroupherServer.CMS.ContentImport.Threads.Changelog
  alias GroupherServer.CMS.ContentImport.Threads.Doc

  @type plan_t :: Doc.PlanPayload.t() | Changelog.PlanPayload.t()
  @type item_t :: Doc.ItemPayload.t() | Changelog.ItemPayload.t()

  @plan_modules %{doc: Doc.PlanPayload, changelog: Changelog.PlanPayload}
  @item_modules %{doc: Doc.ItemPayload, changelog: Changelog.ItemPayload}

  @spec validate_plan(atom(), term()) :: {:ok, plan_t()} | {:error, Diagnostic.t()}
  def validate_plan(thread, payload) do
    with {:ok, module} <- module_for(@plan_modules, thread, "Plan"),
         true <- is_struct(payload, module) do
      {:ok, payload}
    else
      false -> invalid_payload(thread, "Plan")
      {:error, _diagnostic} = error -> error
    end
  end

  @spec validate_items(atom(), [struct()]) :: :ok | {:error, Diagnostic.t()}
  def validate_items(thread, items) do
    with {:ok, module} <- module_for(@item_modules, thread, "Plan.Item"),
         true <- Enum.all?(items, &is_struct(&1.payload, module)) do
      :ok
    else
      false -> invalid_payload(thread, "Plan.Item")
      {:error, _diagnostic} = error -> error
    end
  end

  @spec valid_item?(term()) :: boolean()
  def valid_item?(payload) do
    Enum.any?(Map.values(@item_modules), fn module -> is_struct(payload, module) end)
  end

  @spec encode_plan(plan_t()) :: map()
  def encode_plan(%{__struct__: module} = payload), do: module.encode(payload)

  @spec encode_item(item_t()) :: map()
  def encode_item(%{__struct__: module} = payload), do: module.encode(payload)

  @spec decode_plan(atom(), map()) :: {:ok, plan_t()} | {:error, Diagnostic.t()}
  def decode_plan(thread, payload) when is_map(payload) do
    with {:ok, module} <- module_for(@plan_modules, thread, "Plan") do
      module.new(payload)
    end
  end

  @spec decode_item(atom(), map()) :: {:ok, item_t()} | {:error, Diagnostic.t()}
  def decode_item(thread, payload) when is_map(payload) do
    with {:ok, module} <- module_for(@item_modules, thread, "Plan.Item") do
      module.new(payload)
    end
  end

  @spec bounded_item_preview(item_t()) :: map()
  def bounded_item_preview(%{__struct__: module} = payload), do: module.bounded_preview(payload)

  defp module_for(modules, thread, scope) do
    case Map.fetch(modules, thread) do
      {:ok, module} -> {:ok, module}
      :error -> invalid_payload(thread, scope)
    end
  end

  defp invalid_payload(thread, scope) do
    Diagnostic.error_result(
      "invalid_thread_payload",
      "#{scope} payload does not match thread #{inspect(thread)}"
    )
  end
end
