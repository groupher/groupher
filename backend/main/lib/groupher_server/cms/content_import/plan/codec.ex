defmodule GroupherServer.CMS.ContentImport.Plan.Codec do
  @moduledoc "Versioned JSON codec for private, durable Plan payloads."

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic, Plan}
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Plan.Payload

  @version 1

  @spec version() :: pos_integer()
  def version, do: @version

  @spec hash(Plan.t()) :: String.t()
  def hash(%Plan{} = plan), do: plan |> encode() |> Canonical.sha256()

  @spec dump(Plan.t()) :: {:ok, binary()} | {:error, Diagnostic.t()}
  def dump(%Plan{} = plan) do
    plan
    |> encode()
    |> Jason.encode()
    |> case do
      {:ok, binary} -> {:ok, binary}
      {:error, reason} -> codec_error("plan_payload_encode_failed", reason)
    end
  end

  @spec load(binary()) :: {:ok, Plan.t()} | {:error, Diagnostic.t()}
  def load(binary) when is_binary(binary) do
    with {:ok, payload} <- decode_json(binary),
         :ok <- validate_envelope(payload),
         {:ok, thread} <- existing_atom(payload["thread"], "thread"),
         {:ok, plan_payload} <- Payload.decode_plan(thread, payload["payload"] || %{}),
         {:ok, items} <- decode_items(thread, payload["items"]),
         {:ok, assets} <- decode_assets(payload["assets"]),
         {:ok, plan} <-
           Plan.new(%{
             thread: thread,
             items: items,
             assets: assets,
             payload: plan_payload,
             diagnostics: payload["diagnostics"] || []
           }) do
      {:ok, plan}
    end
  end

  def load(_binary),
    do: Diagnostic.error_result("invalid_plan_payload", "Plan payload must be binary")

  @spec encode(Plan.t()) :: map()
  def encode(%Plan{} = plan) do
    %{
      "type" => "content_import_plan",
      "version" => @version,
      "thread" => Atom.to_string(plan.thread),
      "items" => Enum.map(plan.items, &encode_item/1),
      "assets" => Enum.map(plan.assets, &encode_asset/1),
      "payload" => Payload.encode_plan(plan.payload),
      "diagnostics" => plan.diagnostics
    }
  end

  @spec summary(Plan.t()) :: map()
  def summary(%Plan{} = plan) do
    actions = Enum.frequencies_by(plan.items, &Atom.to_string(&1.action))

    %{
      "thread" => Atom.to_string(plan.thread),
      "itemCount" => length(plan.items),
      "assetCount" => length(plan.assets),
      "diagnosticCount" => length(plan.diagnostics),
      "actions" => actions
    }
  end

  defp encode_item(item) do
    %{
      "externalRef" => item.external_ref,
      "targetRef" => item.target_ref,
      "action" => Atom.to_string(item.action),
      "sourceRevision" => item.source_revision,
      "sourceHash" => item.source_hash,
      "payload" => Payload.encode_item(item.payload)
    }
  end

  defp encode_asset(asset) do
    %{
      "assetKey" => asset.asset_key,
      "source" => encode_source(asset.source),
      "sourcePath" => asset.source_path,
      "mimeType" => asset.mime_type,
      "contentHash" => asset.content_hash,
      "stagingRef" => asset.staging_ref,
      "status" => Atom.to_string(asset.status),
      "references" => asset.references
    }
  end

  defp decode_items(thread, items) when is_list(items),
    do: decode_list(items, &decode_item(thread, &1))

  defp decode_items(_thread, _items),
    do: Diagnostic.error_result("invalid_plan_items", "Plan items payload must be a list")

  defp decode_item(thread, payload) when is_map(payload) do
    with {:ok, action} <- existing_atom(payload["action"], "item action"),
         {:ok, item_payload} <- Payload.decode_item(thread, payload["payload"] || %{}) do
      Item.new(%{
        external_ref: payload["externalRef"],
        target_ref: payload["targetRef"],
        action: action,
        source_revision: payload["sourceRevision"],
        source_hash: payload["sourceHash"],
        payload: item_payload
      })
    end
  end

  defp decode_item(_thread, _payload),
    do: Diagnostic.error_result("invalid_plan_item_payload", "Plan item payload must be a map")

  defp decode_assets(assets) when is_list(assets), do: decode_list(assets, &decode_asset/1)

  defp decode_assets(_assets),
    do: Diagnostic.error_result("invalid_plan_assets", "Plan assets payload must be a list")

  defp decode_asset(payload) when is_map(payload) do
    with {:ok, source} <- decode_source(payload["source"]),
         {:ok, status} <- existing_atom(payload["status"], "asset status") do
      Asset.new(%{
        asset_key: payload["assetKey"],
        source: source,
        source_path: payload["sourcePath"],
        mime_type: payload["mimeType"],
        content_hash: payload["contentHash"],
        staging_ref: payload["stagingRef"],
        status: status,
        references: payload["references"] || []
      })
    end
  end

  defp decode_asset(_payload),
    do: Diagnostic.error_result("invalid_plan_asset_payload", "Plan asset payload must be a map")

  defp encode_source({:entry, external_ref}),
    do: %{"type" => "entry", "externalRef" => external_ref}

  defp encode_source({:remote_url, url}), do: %{"type" => "remote_url", "url" => url}

  defp decode_source(%{"type" => "entry", "externalRef" => external_ref})
       when is_binary(external_ref) and external_ref != "",
       do: {:ok, {:entry, external_ref}}

  defp decode_source(%{"type" => "remote_url", "url" => url})
       when is_binary(url) and url != "",
       do: {:ok, {:remote_url, url}}

  defp decode_source(_source),
    do: Diagnostic.error_result("invalid_plan_asset_source", "Plan asset source is invalid")

  defp decode_list(values, decoder) do
    Enum.reduce_while(values, {:ok, []}, fn value, {:ok, decoded} ->
      case decoder.(value) do
        {:ok, item} -> {:cont, {:ok, [item | decoded]}}
        {:error, diagnostic} -> {:halt, {:error, diagnostic}}
      end
    end)
    |> case do
      {:ok, decoded} -> {:ok, Enum.reverse(decoded)}
      error -> error
    end
  end

  defp validate_envelope(%{"type" => "content_import_plan", "version" => @version}), do: :ok

  defp validate_envelope(_payload) do
    Diagnostic.error_result(
      "unsupported_plan_payload",
      "Plan payload type or version is not supported"
    )
  end

  defp decode_json(binary) do
    case Jason.decode(binary) do
      {:ok, payload} -> {:ok, payload}
      {:error, reason} -> codec_error("plan_payload_decode_failed", reason)
    end
  end

  defp existing_atom(value, field) when is_binary(value) do
    {:ok, String.to_existing_atom(value)}
  rescue
    ArgumentError ->
      Diagnostic.error_result("invalid_plan_atom", "Plan #{field} is not supported")
  end

  defp existing_atom(_value, field),
    do: Diagnostic.error_result("invalid_plan_atom", "Plan #{field} is required")

  defp codec_error(code, reason),
    do: Diagnostic.error_result(code, "Plan payload codec failed", details: inspect(reason))
end
