defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.CMS.Gate.Access -> result
  """

  @doc "Delegates access_check/3 to the owning implementation."
  defdelegate access_check(arg1, arg2, arg3), to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates check_in_transaction/3 to the owning implementation."
  defdelegate check_in_transaction(arg1, arg2, arg3), to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates caller-owned Community workflow admission to the owning implementation."
  defdelegate check_community_workflow_in_transaction(actor, action, community),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates check_in_transaction/4 to the owning implementation."
  defdelegate check_in_transaction(arg1, arg2, arg3, arg4),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates check_in_transaction/5 to the owning implementation."
  defdelegate check_in_transaction(arg1, arg2, arg3, arg4, arg5),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates the interaction-specific join-only check to the owning implementation."
  defdelegate check_interaction_in_transaction(actor, action, resource),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates the Comment-specific join-only check to the owning implementation."
  defdelegate check_comment_in_transaction(actor, action, comment),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates the Community Application join-only check to the owning implementation."
  defdelegate check_application_in_transaction(actor, action, application),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates Community creation admission inside the caller-owned transaction."
  defdelegate check_community_create_in_transaction(actor, target),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates with_application_check/4 to the owning implementation."
  defdelegate with_application_check(arg1, arg2, arg3, arg4),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates with_branch_check/6 to the owning implementation."
  defdelegate with_branch_check(arg1, arg2, arg3, arg4, arg5, arg6),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates with_check/4 to the owning implementation."
  defdelegate with_check(arg1, arg2, arg3, arg4), to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates with_community_check/4 to the owning implementation."
  defdelegate with_community_check(arg1, arg2, arg3, arg4),
    to: GroupherServer.CMS.Gate.Access.Query

  @doc "Delegates with_community_check/5 to the owning implementation."
  defdelegate with_community_check(arg1, arg2, arg3, arg4, arg5),
    to: GroupherServer.CMS.Gate.Access.Query
end
