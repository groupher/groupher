defmodule GroupherServer.Activity.Press do
  @moduledoc """
  Owns Press configuration Activity actions and projections.

      Press command -> Press Activity contract -> PressLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.PressLog
  alias GroupherServer.CMS.Model.PressConfig

  @contracts %{
    config_updated:
      Event.contract(
        [
          :markdown_enabled,
          :feed_enabled,
          :feed_type,
          :feed_count,
          :feed_threads,
          :llms_enabled,
          :sitemap_enabled
        ],
        [:revision],
        [:community_log]
      )
  }

  def contracts, do: Event.classify_contracts(@contracts)
  def schema, do: PressLog
  def stream_field, do: :press_ref
  def resource_type, do: :press
  def log(resource, action, opts), do: Event.log(__MODULE__, resource, action, opts)
  def project(log, surface), do: Event.project(__MODULE__, log, surface)
  def surface_actions(surface), do: Event.surface_actions(__MODULE__, surface)

  def describe(%PressConfig{} = config, _action, opts) do
    ref = Keyword.get(opts, :stream_ref, config.community_id)
    {:ok, descriptor(config.community_id, ref, config)}
  end

  def describe(%{activity_type: :press, community_id: id, ref: ref} = resource, _action, _opts) do
    {:ok, descriptor(id, ref, resource)}
  end

  def describe(_, _, _), do: {:error, Event.error("invalid Activity Press resource")}

  defp descriptor(id, ref, resource) do
    snapshot = Event.snapshot(resource, [:revision])

    %{
      community_id: id,
      press_ref: Event.stringify(ref),
      stream_snapshot: snapshot,
      subject_type: "press_config",
      subject_ref: Event.stringify(ref),
      subject_snapshot: snapshot,
      target_type: nil,
      target_ref: nil,
      target_snapshot: %{}
    }
  end
end
