defmodule GroupherServer.Activity.Model.CommunityLog do
  @moduledoc """
  Stores append-only Activity events for Community streams.

      Community Activity contract -> activity.community_logs -> management surface
  """
  use GroupherServer.Activity.Model.Base,
    table: "community_logs",
    stream_field: :community_ref,
    actions: [
      :blocker_created,
      :blocker_released,
      :blocker_terminated,
      :setup_failed,
      :setup_retried,
      :activated,
      :destroy_scheduled,
      :destroy_cancelled,
      :destroyed,
      :lifecycle_reconciled,
      :activity_exported
    ]
end
