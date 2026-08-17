defmodule GroupherServer.CMS.CommunityApplications.Policy do
  @moduledoc """
  Composable admission policy for creating a community application.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Policy
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.CommunityApplication
  alias GroupherServer.Repo

  @doc """
  Returns whether the user may create a community application.

  The decision combines the feature flag with the single-active-application
  rule. `context` may force `feature_enabled`.

  ## Examples

      CMS.CommunityApplications.Policy.can_apply(%User{id: 1})
      #=> %{allowed: true, reason_code: nil, retry_at: nil, metadata: %{}}

      CMS.CommunityApplications.Policy.can_apply(%User{id: 1}, %{feature_enabled: false})
      #=> %{allowed: false, reason_code: :apply_not_allowed, retry_at: nil, metadata: %{policy: "feature_flag"}}

  """
  @spec can_apply(User.t(), map()) :: map()
  def can_apply(%User{id: user_id}, context \\ %{}) do
    feature_enabled = Map.get(context, :feature_enabled, feature_enabled?())

    cond do
      not feature_enabled ->
        result(false, :apply_not_allowed, %{policy: "feature_flag"})

      blocking_application?(user_id) ->
        result(false, :active_application_exists, %{policy: "single_active_application"})

      true ->
        result(true, nil, %{})
    end
  end

  defp blocking_application?(user_id) do
    statuses = CommunityApplication.blocking_statuses()

    Repo.exists?(
      from(application in CommunityApplication,
        where: application.user_id == ^user_id and application.status in ^statuses
      )
    )
  end

  defp feature_enabled? do
    :groupher_server
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:enabled, true)
  end

  defp result(allowed, reason_code, metadata) do
    %{allowed: allowed, reason_code: reason_code, retry_at: nil, metadata: metadata}
  end
end
