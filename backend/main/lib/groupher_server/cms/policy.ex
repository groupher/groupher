defmodule GroupherServer.CMS.Policy do
  @moduledoc """
  CMS policy context.

  This context owns CMS-specific rule state that affects whether an operation is
  allowed to proceed. It is separate from Analysis metrics and append-only Audit
  records.
  """

  alias __MODULE__.PublishThrottle

  defdelegate log_publish_action(user), to: PublishThrottle
  defdelegate load_publish_throttle(user), to: PublishThrottle
  defdelegate mock_publish_throttle_attr(scope, user, opt), to: PublishThrottle
end
