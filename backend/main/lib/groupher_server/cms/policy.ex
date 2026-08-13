defmodule GroupherServer.CMS.Policy do
  @moduledoc """
  CMS policy context.

  This context owns CMS-specific rule state that affects whether an operation is
  allowed to proceed. It is separate from Analysis metrics and append-only Audit
  records.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Policy
        -> Repo / external boundary
  """

  alias __MODULE__.PublishThrottle

  @doc "Runs `log_publish_action` through the public `Policy` boundary."
  defdelegate log_publish_action(user), to: PublishThrottle
  @doc "Runs `load_publish_throttle` through the public `Policy` boundary."
  defdelegate load_publish_throttle(user), to: PublishThrottle
  @doc "Runs `mock_publish_throttle_attr` through the public `Policy` boundary."
  defdelegate mock_publish_throttle_attr(scope, user, opt), to: PublishThrottle
end
