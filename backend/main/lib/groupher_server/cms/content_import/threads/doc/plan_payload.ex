defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PlanPayload do
  @moduledoc "Typed Doc-level payload kept in a ContentImport Plan."

  alias GroupherServer.CMS.ContentImport.Diagnostic

  @enforce_keys [:schema_version, :source, :target, :tree]
  defstruct [:schema_version, :source, :target, :tree]

  @type t :: %__MODULE__{
          schema_version: pos_integer(),
          source: map(),
          target: map(),
          tree: map()
        }

  @spec new(map()) :: {:ok, t()} | {:error, Diagnostic.t()}
  def new(attrs) when is_map(attrs) do
    schema_version = value(attrs, :schema_version, value(attrs, :schemaVersion))
    source = value(attrs, :source)
    target = value(attrs, :target)
    tree = value(attrs, :tree)

    if is_integer(schema_version) and schema_version > 0 and is_map(source) and is_map(target) and
         is_map(tree) do
      {:ok,
       %__MODULE__{
         schema_version: schema_version,
         source: source,
         target: target,
         tree: tree
       }}
    else
      Diagnostic.error_result(
        "invalid_doc_plan_payload",
        "Doc Plan payload requires schemaVersion, source, target, and tree"
      )
    end
  end

  @spec new!(map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, payload} -> payload
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec encode(t()) :: map()
  def encode(%__MODULE__{} = payload) do
    %{
      "schemaVersion" => payload.schema_version,
      "source" => payload.source,
      "target" => payload.target,
      "tree" => payload.tree
    }
  end

  defp value(attrs, key, default \\ nil),
    do: Map.get(attrs, key, Map.get(attrs, Atom.to_string(key), default))
end
