defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Resource access composition for Gate actions.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Access
        -> allow / deny
        -> domain context
  """

  alias __MODULE__.Community

  defdelegate can(user, action, community), to: Community
  defdelegate check(user, action, community), to: Community
end
