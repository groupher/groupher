defmodule GroupherServer.CMS.Gate.Access.Load do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.CMS.Gate.Access.Load -> result
  """

  @doc "Delegates actor-scoped article_in_community/4 to the owning implementation."
  defdelegate article_in_community(actor, community, thread, article),
    to: GroupherServer.CMS.Gate.Access.Load.Query

  @doc "Delegates actor-scoped article/4 to the owning implementation."
  defdelegate article(actor, community, thread, article),
    to: GroupherServer.CMS.Gate.Access.Load.Query

  @doc "Delegates actor-scoped comment/5 to the owning implementation."
  defdelegate comment(actor, community, thread, article, comment),
    to: GroupherServer.CMS.Gate.Access.Load.Query

  @doc "Delegates community/2 to the owning implementation."
  defdelegate community(arg1, arg2), to: GroupherServer.CMS.Gate.Access.Load.Query

  @doc "Delegates actor-scoped doc/4 to the owning implementation."
  defdelegate doc(actor, community, article, branch_id),
    to: GroupherServer.CMS.Gate.Access.Load.Query
end
