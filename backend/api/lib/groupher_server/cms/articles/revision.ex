defmodule GroupherServer.CMS.Articles.Revision do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.CMS.Articles.Revision -> result
  """

  @doc "Delegates create/2 to the owning implementation."
  defdelegate create(arg1, arg2), to: GroupherServer.CMS.Articles.Revision.Persist
end
