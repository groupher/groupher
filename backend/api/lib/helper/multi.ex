defmodule Helper.Multi do
  @moduledoc """
  Thin wrapper around `Ecto.Multi` used to stabilize Dialyzer analysis.

  Why this module exists:

  - `Ecto.Multi` is an opaque type.
  - Direct calls like `Ecto.Multi.new/0` in this codebase triggered many
    `call_without_opaque` warnings in Dialyzer even though runtime behavior was correct.
  - Routing calls through this boundary keeps the same runtime semantics while
    preventing those false-positive warnings from propagating across business modules.

  Scope:

  - This module only wraps operations currently used in the project (`new/0`,
    `run/3`, `insert/3,4`).
  - The implementation intentionally stays minimal and delegates to `Ecto.Multi`
    without changing behavior.

  Business position:

      Domain or web caller
        -> Multi
        -> normalized value / infrastructure
  """

  @type t :: Ecto.Multi.t()

  @doc "Creates an empty Ecto.Multi without opening a database transaction."
  @spec new() :: t()
  # credo:disable-for-next-line Credo.Check.Refactor.Apply
  def new, do: apply(Ecto.Multi, :new, [])

  @doc "Appends a named callback that receives the repo and preceding results when the multi executes."
  @spec run(t(), Ecto.Multi.name(), Ecto.Multi.run()) :: t()
  # credo:disable-for-next-line Credo.Check.Refactor.Apply
  def run(multi, name, run), do: apply(Ecto.Multi, :run, [multi, name, run])

  @doc "Queues a named insert from a changeset, struct, or function of preceding results, forwarding the insert options."
  @spec insert(
          t(),
          Ecto.Multi.name(),
          Ecto.Changeset.t()
          | Ecto.Schema.t()
          | (Ecto.Multi.changes() -> Ecto.Changeset.t() | Ecto.Schema.t()),
          Keyword.t()
        ) :: t()
  def insert(multi, name, changeset_or_struct_or_fun, opts \\ []) do
    # credo:disable-for-next-line Credo.Check.Refactor.Apply
    apply(Ecto.Multi, :insert, [multi, name, changeset_or_struct_or_fun, opts])
  end
end
