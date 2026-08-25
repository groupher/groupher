defmodule GroupherServer.Activity.Model.PressLog do
  @moduledoc """
  Stores append-only Activity events for Press configuration streams.

      Press Activity contract -> activity.press_logs -> management surface
  """
  use GroupherServer.Activity.Model.Base,
    table: "press_logs",
    stream_field: :press_ref,
    actions: [:config_updated]
end
