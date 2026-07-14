defmodule GroupherServer.CMS.ContentImport.IdempotencyKey do
  @moduledoc "Builds the canonical server-owned identity of one import run."

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic}

  @version 1

  @spec build(map()) :: {:ok, String.t()} | {:error, Diagnostic.t()}
  def build(attrs) when is_map(attrs) do
    with {:ok, connection_id} <- positive_integer(attrs, :connection_id),
         {:ok, manifest_hash} <- required_string(attrs, :snapshot_manifest_hash),
         {:ok, thread} <- thread(attrs),
         {:ok, options} <- options(attrs) do
      identity = %{
        version: @version,
        connection_id: connection_id,
        snapshot_manifest_hash: manifest_hash,
        thread: Atom.to_string(thread),
        scope_ref: value(attrs, :scope_ref),
        effective_options: options,
        run_nonce: value(attrs, :run_nonce)
      }

      {:ok, "v#{@version}:" <> Canonical.sha256(identity)}
    end
  rescue
    error in ArgumentError ->
      Diagnostic.error_result(
        "invalid_import_idempotency_options",
        "Import idempotency options must contain canonical data",
        details: Exception.message(error)
      )
  end

  def build(_attrs) do
    Diagnostic.error_result(
      "invalid_import_idempotency_identity",
      "Import idempotency identity must be a map"
    )
  end

  defp thread(attrs) do
    case value(attrs, :thread) do
      thread when thread in [:doc, :changelog, :post] ->
        {:ok, thread}

      _ ->
        Diagnostic.error_result(
          "invalid_import_idempotency_thread",
          "Import idempotency thread is not supported"
        )
    end
  end

  defp options(attrs) do
    case value(attrs, :effective_options, %{}) do
      options when is_map(options) ->
        {:ok, options}

      _ ->
        Diagnostic.error_result(
          "invalid_import_idempotency_options",
          "Import idempotency options must be a map"
        )
    end
  end

  defp positive_integer(attrs, key) do
    case value(attrs, key) do
      value when is_integer(value) and value > 0 ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "invalid_import_idempotency_#{key}",
          "Import idempotency #{key} must be a positive integer"
        )
    end
  end

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "invalid_import_idempotency_#{key}",
          "Import idempotency #{key} must be a non-empty string"
        )
    end
  end

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
