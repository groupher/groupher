defmodule GroupherServerWeb.Resolvers.CMS.CommunityApplications do
  @moduledoc """
  Adapts Community Application GraphQL fields to the complete domain use cases.

      GraphQL application field -> this resolver -> CMS.CommunityApplications facade
  """
  require GroupherServer.CMS.ErrorCat

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.ErrorCat, as: CmsErrorCat

  @doc "Reads the signed-in user's community application state."
  def community_application_state(_root, _args, %{context: %{cur_user: user}}) do
    CMS.community_applications_state(user)
  end

  @doc "Gets the applicant's own submission by public reference and maps domain errors to GraphQL."
  def community_application(_root, %{ref: public_ref}, %{context: %{cur_user: user}}) do
    CMS.community_applications_get_owned(public_ref, user) |> application_result()
  end

  @doc "Gets application details by public reference for the reviewer."
  def review_community_application(_root, %{ref: public_ref}, %{context: %{cur_user: reviewer}}) do
    CMS.community_applications_review_detail(public_ref, reviewer) |> application_result()
  end

  @doc "Pages the reviewer's application queue using the requested filter and pagination."
  def paged_community_applications(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.community_applications_review_queue_by_public_filter(
      Map.get(args, :filter, %{}),
      Map.get(args, :pagi),
      reviewer
    )
  end

  @doc "Creates an upload intent for the applicant's proposed community logo."
  def create_community_application_logo_upload_intent(
        _root,
        %{input: input},
        %{context: %{cur_user: user}}
      ) do
    CMS.community_applications_create_logo_upload_intent(input, user) |> application_result()
  end

  @doc "Finalizes an application logo upload and maps domain failures to GraphQL reason codes."
  def complete_community_application_logo_upload(_root, %{input: input}, _info) do
    CMS.community_applications_complete_logo_upload(input) |> application_result()
  end

  @doc "Submits the signed-in user's application with the supplied command ID."
  def submit_community_application(
        _root,
        %{input: input, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.community_applications_submit(input, user, command_id) |> application_result()
  end

  @doc "Cancels the applicant's submission at the expected version."
  def cancel_community_application(
        _root,
        %{ref: public_ref, expected_version: expected_version, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.community_applications_cancel(public_ref, user, expected_version, command_id)
    |> application_result()
  end

  @doc "Starts review of the application at the expected version for the signed-in reviewer."
  def start_community_application_review(
        _root,
        %{ref: public_ref, expected_version: expected_version, command_id: command_id},
        %{context: %{cur_user: reviewer}}
      ) do
    CMS.community_applications_start_review(public_ref, reviewer, expected_version, command_id)
    |> application_result()
  end

  @doc "Approves the expected application version with an optional reviewer note."
  def approve_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    metadata = %{note: Map.get(args, :note)}

    CMS.community_applications_approve(
      args.ref,
      reviewer,
      args.expected_version,
      metadata,
      args.command_id
    )
    |> application_result()
  end

  @doc "Rejects the expected application version with a reason code and optional reviewer note."
  def reject_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    reason = %{reason_code: args.reason_code, note: Map.get(args, :note)}

    CMS.community_applications_reject(
      args.ref,
      reviewer,
      args.expected_version,
      reason,
      args.command_id
    )
    |> application_result()
  end

  @doc "Retries community creation for the specified application version."
  def retry_community_creation(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.community_applications_retry_creation(
      args.ref,
      reviewer,
      args.expected_version,
      args.command_id
    )
    |> application_result()
  end

  @doc "Retries community setup for the specified application version."
  def retry_community_setup(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.community_applications_retry_setup(
      args.ref,
      reviewer,
      args.expected_version,
      args.command_id
    )
    |> application_result()
  end

  @doc "Resolves the logo associated with the parent application."
  def community_application_logo(application, _args, _info) do
    CMS.community_applications_logo(application) |> application_result()
  end

  @doc "Resolves the applicant associated with the parent application."
  def application_applicant(application, _args, _info) do
    CMS.community_applications_applicant(application) |> application_result()
  end

  @doc "Resolves the reviewer associated with the parent application."
  def application_reviewer(application, _args, _info) do
    CMS.community_applications_reviewer(application) |> application_result()
  end

  @doc "Resolves the community associated with the parent application."
  def application_community(application, _args, _info) do
    CMS.community_applications_application_community(application) |> application_result()
  end

  @doc "Pages the events recorded for the parent application."
  def community_application_events(application, args, _info) do
    CMS.community_applications_events(application, Map.get(args, :pagi))
  end

  @doc "Uses the actor's login as the public application actor reference."
  def application_actor_ref(actor, _args, _info) do
    {:ok, actor.login}
  end

  @doc "Uses the community slug as the public application community reference."
  def application_community_ref(community, _args, _info) do
    {:ok, community.slug}
  end

  @doc "Projects the last job failure's reason, message, operation, time, and attempt, or returns nil."
  def application_job_error(%{last_job_error: nil}, _args, _info) do
    {:ok, nil}
  end

  def application_job_error(%{last_job_error: error}, _args, _info) do
    {:ok,
     %{
       reason_code: error["reason_code"],
       message: error["message"],
       operation_ref: error["operation_ref"],
       occurred_at: error["occurred_at"],
       attempt: error["attempt"]
     }}
  end

  @doc "Resolves the actor associated with the parent application event."
  def application_event_actor(event, _args, _info) do
    CMS.community_applications_event_actor(event) |> application_result()
  end

  @doc "Looks up the application logo's origin by public reference."
  def community_application_logo_origin_info(_root, %{public_ref: public_ref}, _info) do
    CMS.community_applications_logo_origin(public_ref) |> application_result()
  end

  defp application_result({:ok, value}) do
    {:ok, value}
  end

  defp application_result({:error, reason}) do
    reason_code = reason |> normalize_reason() |> Atom.to_string()

    {:error,
     message: reason_code,
     extensions: %{code: ErrorCat.code(ErrorCat.custom()), reasonCode: reason_code}}
  end

  defp normalize_reason({reason, _metadata}) when is_atom(reason) do
    reason
  end

  defp normalize_reason(CmsErrorCat.error_pattern(reason: reason)) do
    reason
  end

  defp normalize_reason(reason) when is_atom(reason) do
    reason
  end

  defp normalize_reason(_) do
    :apply_not_allowed
  end
end
