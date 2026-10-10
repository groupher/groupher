defmodule GroupherServer.CMS.Gate.Access.Policy.Application do
  @moduledoc """
  Admission rules for the Community Application aggregate.

      Command -> Application Gate -> applicant/reviewer policy -> allowed or denial
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.CommunityApplications.Policy
  alias CMS.Communities.ErrorCat
  alias CMS.Gate.Const
  alias CMS.Model.CommunityApplication
  alias CMS.Passport

  require CMS.Gate.Const

  @doc "Checks an applicant starting a new application command."
  def check_create(%User{} = actor) do
    case Policy.can_apply(actor) do
      %{allowed: true} -> {:ok, :pass}
      %{allowed: false} = denial -> {:error, Policy.denial_error(denial)}
    end
  end

  @doc "Checks a user or reviewer action against a canonical application."
  def check_access(%User{id: user_id}, :application_cancel, %CommunityApplication{
        user_id: user_id
      }),
      do: {:ok, :pass}

  def check_access(actor, action, %CommunityApplication{})
      when action in [
             :application_review,
             :application_approve,
             :application_reject,
             :application_retry_creation,
             :application_retry_setup
           ] do
    passport_action = passport_action(action)

    case Passport.check(actor, passport_action, %{}) do
      {:ok, true} -> {:ok, :pass}
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end

  def check_access(_actor, _action, _application),
    do: {:error, ErrorCat.application_not_found()}

  defp passport_action(:application_review),
    do: Const.passport_action(:community_application_review)

  defp passport_action(:application_approve),
    do: Const.passport_action(:community_application_approve)

  defp passport_action(:application_reject),
    do: Const.passport_action(:community_application_reject)

  defp passport_action(:application_retry_creation),
    do: Const.passport_action(:community_application_retry_creation)

  defp passport_action(:application_retry_setup),
    do: Const.passport_action(:community_application_retry_setup)
end
