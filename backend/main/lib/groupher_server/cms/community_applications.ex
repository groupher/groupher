defmodule GroupherServer.CMS.CommunityApplications do
  require GroupherServer.CMS.Gate.Const
  @moduledoc """
  Public facade for the Community Application aggregate.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> CommunityApplications
        -> Repo / external boundary
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.ErrorCat
  alias GroupherServer.CMS.Gate.Const
  alias GroupherServer.CMS.Passport

  alias GroupherServer.CMS.CommunityApplications.{
    LogoUploads,
    Policy,
    Reader,
    Review,
    Writer
  }

  alias Helper.T

  require Const

  @spec current(User.t()) :: T.domain_res(term())
  @doc "Runs `current` through the public `CommunityApplications` boundary."
  def current(%User{} = user), do: Reader.current(user)

  @spec latest_failed(User.t()) :: T.domain_res(term())
  @doc "Runs `latest_failed` through the public `CommunityApplications` boundary."
  def latest_failed(%User{} = user), do: Reader.latest_failed(user)

  @spec history(User.t(), map()) :: T.domain_res(term())
  @doc "Runs `history` through the public `CommunityApplications` boundary."
  def history(%User{} = user, filter \\ %{}), do: Reader.history(user, filter)

  @spec get_owned(String.t(), User.t()) :: T.domain_res(term())
  @doc "Returns owned through the `CommunityApplications` boundary."
  def get_owned(public_ref, %User{} = user), do: Reader.owned(public_ref, user)

  @spec review_queue(map(), User.t()) :: T.domain_res(term())
  @doc "Runs `review_queue` through the public `CommunityApplications` boundary."
  def review_queue(filter, %User{} = reviewer) do
    with :ok <- review_authorized?(reviewer, Const.passport_action(:community_application_review)) do
      Reader.review_queue(filter)
    end
  end

  @spec review_detail(String.t(), User.t()) :: T.domain_res(term())
  @doc "Runs `review_detail` through the public `CommunityApplications` boundary."
  def review_detail(public_ref, %User{} = reviewer) do
    with :ok <- review_authorized?(reviewer, Const.passport_action(:community_application_review)) do
      Reader.review_detail(public_ref)
    end
  end

  @spec events(term(), map()) :: T.domain_res(term())
  @doc "Runs `events` through the public `CommunityApplications` boundary."
  def events(application, filter \\ %{}), do: Reader.events(application, filter)

  @doc "Runs `applicant` through the public `CommunityApplications` boundary."
  def applicant(application), do: Reader.applicant(application)
  @doc "Runs `reviewer` through the public `CommunityApplications` boundary."
  def reviewer(application), do: Reader.reviewer(application)
  @doc "Runs `application_community` through the public `CommunityApplications` boundary."
  def application_community(application), do: Reader.community(application)
  @doc "Runs `event_actor` through the public `CommunityApplications` boundary."
  def event_actor(event), do: Reader.event_actor(event)
  @doc "Runs `logo` through the public `CommunityApplications` boundary."
  def logo(application), do: Reader.logo(application)
  @doc "Runs `logo_origin` through the public `CommunityApplications` boundary."
  def logo_origin(public_ref), do: Reader.logo_origin(public_ref)

  defp review_authorized?(reviewer, action) do
    case Passport.check(reviewer, action, %{}) do
      {:ok, true} -> :ok
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end

  @spec can_apply(User.t()) :: map()
  @doc "Reports whether apply according to `CommunityApplications`."
  def can_apply(%User{} = user), do: Policy.can_apply(user)

  @spec submit(map(), User.t(), String.t()) :: T.domain_res(term())
  @doc "Runs `submit` through the public `CommunityApplications` boundary."
  def submit(attrs, %User{} = user, idempotency_key),
    do: Writer.submit(attrs, user, idempotency_key)

  @spec cancel(String.t(), User.t(), integer()) :: T.domain_res(term())
  @doc "Runs `cancel` through the public `CommunityApplications` boundary."
  def cancel(public_ref, %User{} = user, expected_version),
    do: Writer.cancel(public_ref, user, expected_version)

  @spec start_review(String.t(), User.t(), integer()) :: T.domain_res(term())
  @doc "Runs `start_review` through the public `CommunityApplications` boundary."
  def start_review(public_ref, %User{} = reviewer, expected_version),
    do: Review.start(public_ref, reviewer, expected_version)

  @spec approve(String.t(), User.t(), integer(), map()) :: T.domain_res(term())
  @doc "Runs `approve` through the public `CommunityApplications` boundary."
  def approve(public_ref, %User{} = reviewer, expected_version, metadata),
    do: Review.approve(public_ref, reviewer, expected_version, metadata)

  @spec reject(String.t(), User.t(), integer(), map()) :: T.domain_res(term())
  @doc "Runs `reject` through the public `CommunityApplications` boundary."
  def reject(public_ref, %User{} = reviewer, expected_version, reason),
    do: Review.reject(public_ref, reviewer, expected_version, reason)

  @spec retry_creation(String.t(), User.t(), integer()) :: T.domain_res(term())
  @doc "Runs `retry_creation` through the public `CommunityApplications` boundary."
  def retry_creation(public_ref, %User{} = reviewer, expected_version),
    do: Review.retry_creation(public_ref, reviewer, expected_version)

  @spec create_logo_upload_intent(map(), User.t()) :: T.domain_res(term())
  @doc "Creates logo upload intent through the `CommunityApplications` write boundary."
  def create_logo_upload_intent(attrs, %User{} = user), do: LogoUploads.create_intent(attrs, user)

  @spec complete_logo_upload(map()) :: T.domain_res(term())
  @doc "Runs `complete_logo_upload` through the public `CommunityApplications` boundary."
  def complete_logo_upload(attrs), do: LogoUploads.complete(attrs)

  @spec expire_logo_uploads(DateTime.t()) :: {non_neg_integer(), nil}
  @doc "Runs `expire_logo_uploads` through the public `CommunityApplications` boundary."
  def expire_logo_uploads(now), do: LogoUploads.expire_due(now)

  @spec expire_due(DateTime.t()) :: T.domain_res(non_neg_integer())
  @doc "Runs `expire_due` through the public `CommunityApplications` boundary."
  def expire_due(now), do: Writer.expire_due(now)

  @spec mark_creation_failed(String.t(), String.t(), term()) :: T.domain_res(term())
  @doc "Runs `mark_creation_failed` through the public `CommunityApplications` boundary."
  def mark_creation_failed(public_ref, operation_ref, reason),
    do: Review.mark_creation_failed(public_ref, operation_ref, reason)
end
