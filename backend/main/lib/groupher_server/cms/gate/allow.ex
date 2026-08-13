defmodule GroupherServer.CMS.Gate.Allow do
  @moduledoc """
  Gate facade for feature and resource-state allowances.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Allow
        -> allow / deny
        -> domain context
  """

  alias __MODULE__.Community

  defdelegate thread(community, thread), to: Community, as: :allow_thread
  defdelegate emotion(community, scope, thread, emotion), to: Community, as: :allow_emotion
  defdelegate comment(article), to: Community, as: :allow_comment
end
