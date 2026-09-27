defmodule GroupherServer.CMS.ViewTracker.Policy do
  @moduledoc """
  Decides whether one classified read may enter business deduplication.

      RequestActor identity + read purpose -> Policy.allowed?/2
  """

  @policy_version 1

  @read_purposes [
    :public_read,
    :author_preview,
    :moderation_review,
    :operations_inspection,
    :internal_probe
  ]

  @doc "Returns whether one normalized identity and purpose may be counted."
  @spec allowed?(map(), atom()) :: boolean()
  def allowed?(identity, :public_read) when is_map(identity), do: allowed_actor?(identity)
  def allowed?(_identity, purpose) when purpose in @read_purposes, do: false
  def allowed?(_identity, _purpose), do: false

  @doc "Returns the policy version persisted with counted MetricEvents."
  @spec version() :: pos_integer()
  def version, do: @policy_version

  defp allowed_actor?(%{
         actor_type: :human,
         actor_confidence: confidence,
         viewer_tracking_key: key
       })
       when confidence in [:verified, :probable] and is_binary(key),
       do: true

  defp allowed_actor?(%{
         actor_type: :agent,
         actor_confidence: :verified,
         viewer_tracking_key: key
       })
       when is_binary(key),
       do: true

  defp allowed_actor?(_identity), do: false
end
