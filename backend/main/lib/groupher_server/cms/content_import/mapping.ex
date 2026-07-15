defmodule GroupherServer.CMS.ContentImport.Mapping do
  @moduledoc """
  In-memory source-to-thread identity used by planning before persistence exists.

      external_ref <----------> target_ref
           |                         |
           +--> imported source hash |
           `--> imported local hash  |
                     |               |
                     +------ Diff ---+
                                |
                                v
                       create / update / conflict /
                       source_deleted

  Mapping is the synchronization baseline, not import execution state. Job owns
  execution and administrator decisions; Mapping advances only after apply.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Entry}

  @enforce_keys [:connection_ref, :external_ref, :thread, :target_ref]
  defstruct [
    :connection_ref,
    :external_ref,
    :thread,
    :target_ref,
    :last_imported_revision,
    :last_imported_source_hash,
    :last_imported_local_hash,
    :last_imported_at
  ]

  @type t :: %__MODULE__{
          connection_ref: String.t(),
          external_ref: Entry.external_ref(),
          thread: atom(),
          target_ref: String.t(),
          last_imported_revision: String.t() | nil,
          last_imported_source_hash: String.t() | nil,
          last_imported_local_hash: String.t() | nil,
          last_imported_at: DateTime.t() | nil
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    with {:ok, connection_ref} <- required_string(attrs, :connection_ref),
         {:ok, external_ref} <- required_string(attrs, :external_ref),
         {:ok, target_ref} <- required_string(attrs, :target_ref),
         {:ok, thread} <- thread(attrs) do
      {:ok,
       %__MODULE__{
         connection_ref: connection_ref,
         external_ref: external_ref,
         thread: thread,
         target_ref: target_ref,
         last_imported_revision: value(attrs, :last_imported_revision),
         last_imported_source_hash: value(attrs, :last_imported_source_hash),
         last_imported_local_hash: value(attrs, :last_imported_local_hash),
         last_imported_at: value(attrs, :last_imported_at)
       }}
    end
  end

  def new(_attrs),
    do: Diagnostic.error_result("invalid_mapping", "mapping attributes must be a map")

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, mapping} -> mapping
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  defp required_string(attrs, key) do
    case value(attrs, key) do
      value when is_binary(value) and value != "" ->
        {:ok, value}

      _ ->
        Diagnostic.error_result(
          "mapping_#{key}_required",
          "mapping #{key} must be a non-empty string"
        )
    end
  end

  defp thread(attrs) do
    case value(attrs, :thread) do
      thread when is_atom(thread) and not is_nil(thread) -> {:ok, thread}
      _ -> Diagnostic.error_result("mapping_thread_required", "mapping thread must be an atom")
    end
  end

  defp value(attrs, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
  end
end
