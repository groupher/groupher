defmodule GroupherServer.CMS.FrontDesk.Lookup do
  @moduledoc """
  Owns the FrontDesk facade's controlled generic lookup compatibility surface.

  Business position:

      CMS.FrontDesk facade / FrontDesk.Relation
        -> FrontDesk.Lookup
        -> Helper.ORM
  """

  alias Helper.ORM

  @doc "Finds one schema row by primary id."
  def get(queryable, id), do: ORM.find(queryable, id)

  @doc "Finds one schema row by primary id with preloads."
  def get(queryable, id, preload: preload), do: ORM.find(queryable, id, preload: preload)

  @doc "Finds one schema row by clauses."
  def get_by(queryable, clauses), do: ORM.find_by(queryable, clauses)

  @doc "Finds one schema row by clauses with preloads."
  def get_by(queryable, clauses, preload: preload),
    do: ORM.find_by(queryable, clauses, preload: preload)
end
