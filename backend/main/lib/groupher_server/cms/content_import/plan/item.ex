defmodule GroupherServer.CMS.ContentImport.Plan.Item do
  @moduledoc "One source entry projected into a thread-specific action."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry}
  alias GroupherServer.CMS.ContentImport.Plan.Payload

  @actions [:create, :update, :skip, :conflict]

  @enforce_keys [:external_ref, :target_ref, :action, :source_hash, :payload]
  defstruct [:external_ref, :target_ref, :action, :source_revision, :source_hash, :payload]

  @type action :: :create | :update | :skip | :conflict
  @type t :: %__MODULE__{
          external_ref: Entry.external_ref(),
          target_ref: String.t(),
          action: action(),
          source_revision: String.t() | nil,
          source_hash: String.t(),
          payload: Payload.item_t()
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    with {:ok, external_ref} <- required_string(attrs, :external_ref),
         {:ok, target_ref} <- required_string(attrs, :target_ref),
         {:ok, source_hash} <- required_string(attrs, :source_hash),
         {:ok, action} <- action(attrs),
         {:ok, payload} <- payload(attrs) do
      {:ok,
       %__MODULE__{
         external_ref: external_ref,
         target_ref: target_ref,
         action: action,
         source_revision: value(attrs, :source_revision),
         source_hash: source_hash,
         payload: payload
       }}
    end
  end

  def new(_attrs),
    do: Diagnostic.error_result("invalid_plan_item", "plan item attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, item} -> item
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  defp action(attrs) do
    case value(attrs, :action) do
      action when action in @actions ->
        {:ok, action}

      _ ->
        Diagnostic.error_result("invalid_plan_item_action", "plan item action is not supported")
    end
  end

  defp payload(attrs) do
    case value(attrs, :payload) do
      payload when not is_nil(payload) ->
        if Payload.valid_item?(payload),
          do: {:ok, payload},
          else:
            Diagnostic.error_result(
              "invalid_plan_item_payload",
              "plan item payload must be a thread-specific payload struct"
            )

      _ ->
        Diagnostic.error_result(
          "invalid_plan_item_payload",
          "plan item payload must be a thread-specific payload struct"
        )
    end
  end

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "plan_item_#{key}_required",
          "plan item #{key} must be a non-empty string"
        )
    end
  end

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
