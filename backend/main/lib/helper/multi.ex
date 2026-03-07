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
  """

  @type t :: Ecto.Multi.t()

  @spec new() :: t()
  def new, do: apply(Ecto.Multi, :new, [])

  @spec run(t(), Ecto.Multi.name(), Ecto.Multi.run()) :: t()
  def run(multi, name, run), do: apply(Ecto.Multi, :run, [multi, name, run])

  @spec insert(
          t(),
          Ecto.Multi.name(),
          Ecto.Changeset.t()
          | Ecto.Schema.t()
          | (Ecto.Multi.changes() -> Ecto.Changeset.t() | Ecto.Schema.t()),
          Keyword.t()
        ) :: t()
  def insert(multi, name, changeset_or_struct_or_fun, opts \\ []) do
    apply(Ecto.Multi, :insert, [multi, name, changeset_or_struct_or_fun, opts])
  end
end
