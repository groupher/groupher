defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Preparation do
  @moduledoc """
  Snapshot-bound result of the Docs framework detection and navigation parse.

  A Preparation is private to the Doc thread. It prevents callers from pairing
  a Snapshot with an unrelated source tree and gives durable workflows a stable
  parser checkpoint to persist between fetch and planning.

      Snapshot manifest_hash
               +
      detected framework
               +
      parsed SourceTree
               |
               v
         preparation_hash
               |
               v
          Preparation ------> Doc.plan

  Both manifest and preparation hashes are checked when the durable checkpoint
  is loaded, so a parsed tree cannot be replayed against a different Snapshot.
  """

  alias GroupherServer.CMS.ContentImport.{Canonical, Diagnostic, Snapshot}

  @version 1

  @enforce_keys [
    :snapshot_manifest_hash,
    :framework,
    :version,
    :source_tree,
    :preparation_hash
  ]
  defstruct [
    :snapshot_manifest_hash,
    :framework,
    :version,
    :source_tree,
    :preparation_hash,
    diagnostics: []
  ]

  @type framework ::
          :docusaurus | :fumadocs | :mkdocs | :nextra | :rspress | :starlight | :vitepress

  @type t :: %__MODULE__{
          snapshot_manifest_hash: String.t(),
          framework: framework(),
          version: pos_integer(),
          source_tree: map(),
          preparation_hash: String.t(),
          diagnostics: [Diagnostic.t() | map()]
        }

  @spec version() :: pos_integer()
  def version, do: @version

  @spec new(Snapshot.t(), framework(), map(), [Diagnostic.t() | map()]) ::
          {:ok, t()} | {:error, Diagnostic.t()}
  def new(%Snapshot{} = snapshot, framework, source_tree, diagnostics \\ []) do
    with :ok <- validate_framework(framework),
         :ok <- validate_source_tree(source_tree),
         :ok <- validate_diagnostics(diagnostics) do
      preparation = %__MODULE__{
        snapshot_manifest_hash: snapshot.manifest_hash,
        framework: framework,
        version: @version,
        source_tree: source_tree,
        preparation_hash: "",
        diagnostics: diagnostics
      }

      {:ok, %{preparation | preparation_hash: preparation_hash(preparation)}}
    end
  end

  @spec new!(Snapshot.t(), framework(), map(), [Diagnostic.t() | map()]) :: t()
  def new!(%Snapshot{} = snapshot, framework, source_tree, diagnostics \\ []) do
    case new(snapshot, framework, source_tree, diagnostics) do
      {:ok, preparation} -> preparation
      {:error, diagnostic} -> raise ArgumentError, diagnostic.message
    end
  end

  @spec matches_snapshot?(t(), Snapshot.t()) :: boolean()
  def matches_snapshot?(%__MODULE__{} = preparation, %Snapshot{} = snapshot) do
    preparation.snapshot_manifest_hash == snapshot.manifest_hash
  end

  @spec preparation_hash(t()) :: String.t()
  def preparation_hash(%__MODULE__{} = preparation) do
    Canonical.sha256(%{
      snapshot_manifest_hash: preparation.snapshot_manifest_hash,
      framework: Atom.to_string(preparation.framework),
      version: preparation.version,
      source_tree: preparation.source_tree
    })
  end

  defp validate_framework(framework)
       when framework in [
              :docusaurus,
              :fumadocs,
              :mkdocs,
              :nextra,
              :rspress,
              :starlight,
              :vitepress
            ],
       do: :ok

  defp validate_framework(_framework) do
    Diagnostic.error_result(
      "invalid_doc_preparation_framework",
      "Doc preparation framework is not supported"
    )
  end

  defp validate_source_tree(source_tree) when is_map(source_tree), do: :ok

  defp validate_source_tree(_source_tree) do
    Diagnostic.error_result(
      "invalid_doc_preparation_tree",
      "Doc preparation source_tree must be a map"
    )
  end

  defp validate_diagnostics(diagnostics) when is_list(diagnostics), do: :ok

  defp validate_diagnostics(_diagnostics) do
    Diagnostic.error_result(
      "invalid_doc_preparation_diagnostics",
      "Doc preparation diagnostics must be a list"
    )
  end
end
