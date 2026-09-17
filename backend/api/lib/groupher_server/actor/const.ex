defmodule GroupherServer.Actor.Const do
  @moduledoc """
  Platform-level vocabulary for classifying request actors.

  The vocabulary is shared by ViewTracker producers and Analysis consumers;
  `CMS.ViewTracker.Classifier` remains the owner of classification policy.

      request identity -> Actor.Const vocabulary -> ViewTracker / Analysis
  """

  @actor_types [:human, :agent, :crawler, :unknown]

  @doc "Returns the closed actor-type vocabulary used by analytics events."
  @spec actor_types() :: [atom()]
  def actor_types, do: @actor_types

  @doc "Checks whether a value is a supported actor type."
  @spec valid_actor_type?(atom()) :: boolean()
  def valid_actor_type?(type), do: type in @actor_types
end
