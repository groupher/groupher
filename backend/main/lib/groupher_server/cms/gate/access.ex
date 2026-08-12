defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc "Resource access composition for Gate actions."

  alias __MODULE__.Community

  defdelegate can(user, action, community), to: Community
  defdelegate check(user, action, community), to: Community
end
