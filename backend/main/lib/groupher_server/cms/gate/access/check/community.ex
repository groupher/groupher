defmodule GroupherServer.CMS.Gate.Access.Check.Community do
  @moduledoc """
  Executes Community single-resource access checks.

  This flow loads the authoritative Community Access Context, runs the
  Community policy, and converts the policy result into a Gate Decision. It
  does not implement Community policy rules itself.

      Community resource
        -> Loader.Community
        -> Context.Access.Community
        -> Access.Community.check_access/4
        -> Decision
        -> canonical Community or denial
  """

  alias GroupherServer.CMS.Gate.Access.Community, as: CommunityPolicy
  alias GroupherServer.CMS.Gate.Access.Loader
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Model.Community

  @doc false
  @spec run(term(), atom(), Community.t()) ::
          {:ok, Community.t()} | {:error, Decision.t()}
  def run(actor, action, %Community{} = community) do
    with {:ok, context} <- Loader.community(community),
         %Decision{allowed: true} <- decision(actor, action, context.community, context) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, reason} -> {:error, Decision.deny(reason)}
    end
  end

  defp decision(actor, action, resource, context),
    do:
      Decision.from_result(
        CommunityPolicy.check_access(actor, action, resource, context),
        context
      )
end
