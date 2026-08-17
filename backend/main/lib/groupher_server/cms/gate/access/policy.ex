defmodule GroupherServer.CMS.Gate.Access.Policy do
  @moduledoc """
  Contract implemented by resource Access policies.

  Loaders provide the typed Access Context; policies only decide whether the
  requested action is admitted. Decision conversion remains private to Gate.

      Access.Check.*
        -> Access policy
        -> :ok | {:error, reason}
  """

  @doc "Checks one actor/action/resource tuple against a typed Access Context."

  @callback check_access(
              actor :: term(),
              action :: atom(),
              resource :: map(),
              context :: struct()
            ) :: :ok | {:error, atom()}
end
