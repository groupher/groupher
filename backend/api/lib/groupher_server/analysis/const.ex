defmodule GroupherServer.Analysis.Const do
  @moduledoc """
  Closed vocabulary for Analysis metric events and dimensions.

      producer action -> Analysis.Const vocabulary -> MetricEvent / query
  """

  alias GroupherServer.RequestActor
  alias RequestActor.Const, as: RequestActorConst

  @metrics [
    :article_view,
    :upvote_added,
    :upvote_removed,
    :collect_added,
    :collect_removed,
    :emotion_added,
    :emotion_removed,
    :comment_created,
    :comment_deleted
  ]

  @doc "Returns the supported business metric names."
  @spec metrics() :: [atom()]
  def metrics, do: @metrics

  @doc "Returns actor types plus the non-actor all aggregate dimension."
  @spec actor_dimensions() :: [atom()]
  def actor_dimensions, do: RequestActorConst.actor_types() ++ [:all]
end
