defmodule GroupherServer.CMS.Communities.Admins.Requests do
  @moduledoc """
  Exposes bounded request-expiration maintenance through the Admins namespace.

      CMS scheduled entry -> Requests -> ExpireDue -> locked expiry command
  """

  @doc "Expires due requests through the bounded scan and locked command owner."
  defdelegate expire_due(now), to: __MODULE__.ExpireDue, as: :run
end
