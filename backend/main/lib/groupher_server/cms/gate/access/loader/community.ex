defmodule GroupherServer.CMS.Gate.Access.Loader.Community do
  @moduledoc """
  Loads and locks Community facts for the Community Access Context.

      Community resource -> Community Loader -> Community Context -> Access policy

  `load/1` is called only by `Access.Check.Community`.
  """

  alias GroupherServer.CMS.Gate.Access.Loader.Queries
  alias GroupherServer.CMS.Gate.Context.Access.Community, as: CommunityContext
  alias GroupherServer.CMS.Model.{Community, CommunityLifecycle}

  @doc false
  def load(%Community{} = community) do
    case Queries.community_lifecycle(community.id) do
      %CommunityLifecycle{} = lifecycle ->
        {:ok,
         %CommunityContext{
           community: %{community | lifecycle: lifecycle},
           community_lifecycle: lifecycle
         }}

      nil ->
        {:error, :lifecycle_not_found}
    end
  end
end
