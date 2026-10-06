defmodule GroupherServerWeb.Resolvers.CMS.Passport do
  @moduledoc """
  Exposes CMS Passport rule registries through GraphQL fields.

      CMS Passport registry -> this resolver -> GraphQL rule payload
  """

  alias GroupherServer.CMS

  def all_passport_rules(_root, _args, _info) do
    with {:ok, rules} <- CMS.Communities.all_passport_rules() do
      {:ok, %{root: Jason.encode!(rules.root), moderator: Jason.encode!(rules.moderator)}}
    end
  end
end
