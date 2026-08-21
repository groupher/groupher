defmodule GroupherServer.Activity.Const do
  @moduledoc """
  Closed protocol vocabulary owned by the Activity context.

  Activity business modules use this module instead of depending on a global
  business-constant catalog. Database migrations keep a frozen DDL snapshot of
  the same values and are checked for parity in tests.

      Activity producer -> Activity.Const -> Event/schema validation
  """

  @sources [:api, :admin, :worker, :scheduler, :maintenance]
  @actor_types [:user, :system]
  @surfaces [:article_log, :community_log]

  @spec source_values() :: [atom()]
  def source_values, do: @sources

  @spec actor_type_values() :: [atom()]
  def actor_type_values, do: @actor_types

  @spec surface_values() :: [atom()]
  def surface_values, do: @surfaces

  @spec valid_source?(term()) :: boolean()
  def valid_source?(source), do: source in @sources

  @spec valid_actor_type?(term()) :: boolean()
  def valid_actor_type?(actor_type), do: actor_type in @actor_types

  @spec valid_surface?(term()) :: boolean()
  def valid_surface?(surface), do: surface in @surfaces
end
