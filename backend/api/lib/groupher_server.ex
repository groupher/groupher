defmodule GroupherServer do
  @moduledoc """
  Root namespace for Groupher's Phoenix modular monolith.

  Domain contexts own business rules and persisted state. Web resolvers, jobs,
  and internal-service boundaries enter through those contexts instead of
  calling schemas or `GroupherServer.Repo` directly.

  Business position:

      HTTP / job / internal service
        -> Accounts / CMS / Messaging / Analysis context
        -> policy + lifecycle + read/write module
        -> GroupherServer.Repo / bounded external service
  """
end
