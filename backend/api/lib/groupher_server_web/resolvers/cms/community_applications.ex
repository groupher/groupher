defmodule GroupherServerWeb.Resolvers.CMS.CommunityApplications do
  @moduledoc """
  Adapts Community Application GraphQL fields to the complete domain use cases.

      GraphQL application field -> this resolver -> CMS.CommunityApplications facade
  """
  require GroupherServer.CMS.ErrorCat

  alias GroupherServer.{CMS, ErrorCat}
  alias GroupherServer.CMS.ErrorCat, as: CmsErrorCat

  def community_application_state(_root, _args, %{context: %{cur_user: user}}) do
    CMS.CommunityApplications.state(user)
  end

  def community_application(_root, %{ref: public_ref}, %{context: %{cur_user: user}}) do
    CMS.CommunityApplications.get_owned(public_ref, user) |> application_result()
  end

  def review_community_application(_root, %{ref: public_ref}, %{context: %{cur_user: reviewer}}) do
    CMS.CommunityApplications.review_detail(public_ref, reviewer) |> application_result()
  end

  def paged_community_applications(_root, args, %{context: %{cur_user: reviewer}}) do
    filter =
      args
      |> Map.get(:filter, %{})
      |> Map.put(:first, Map.get(args, :first, 20))
      |> Map.put(:after, Map.get(args, :after))

    case CMS.CommunityApplications.review_queue_by_public_filter(filter, reviewer) do
      {:ok, page} -> {:ok, connection(page.entries, page.has_next_page, &application_cursor/1)}
      error -> application_result(error)
    end
  end

  def create_community_application_logo_upload_intent(
        _root,
        %{input: input},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.create_logo_upload_intent(input, user) |> application_result()
  end

  def complete_community_application_logo_upload(_root, %{input: input}, _info) do
    CMS.CommunityApplications.complete_logo_upload(input) |> application_result()
  end

  def submit_community_application(
        _root,
        %{input: input, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.submit(input, user, command_id) |> application_result()
  end

  def cancel_community_application(
        _root,
        %{ref: public_ref, expected_version: expected_version, command_id: command_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.cancel(public_ref, user, expected_version, command_id)
    |> application_result()
  end

  def start_community_application_review(
        _root,
        %{ref: public_ref, expected_version: expected_version, command_id: command_id},
        %{context: %{cur_user: reviewer}}
      ) do
    CMS.CommunityApplications.start_review(public_ref, reviewer, expected_version, command_id)
    |> application_result()
  end

  def approve_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    metadata = %{note: Map.get(args, :note)}

    CMS.CommunityApplications.approve(
      args.ref,
      reviewer,
      args.expected_version,
      metadata,
      args.command_id
    )
    |> application_result()
  end

  def reject_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    reason = %{reason_code: args.reason_code, note: Map.get(args, :note)}

    CMS.CommunityApplications.reject(
      args.ref,
      reviewer,
      args.expected_version,
      reason,
      args.command_id
    )
    |> application_result()
  end

  def retry_community_creation(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.CommunityApplications.retry_creation(
      args.ref,
      reviewer,
      args.expected_version,
      args.command_id
    )
    |> application_result()
  end

  def retry_community_setup(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.CommunityApplications.retry_setup(
      args.ref,
      reviewer,
      args.expected_version,
      args.command_id
    )
    |> application_result()
  end

  def community_application_logo(application, _args, _info) do
    CMS.CommunityApplications.logo(application) |> application_result()
  end

  def application_applicant(application, _args, _info) do
    CMS.CommunityApplications.applicant(application) |> application_result()
  end

  def application_reviewer(application, _args, _info) do
    CMS.CommunityApplications.reviewer(application) |> application_result()
  end

  def application_community(application, _args, _info) do
    CMS.CommunityApplications.application_community(application) |> application_result()
  end

  def community_application_events(application, args, _info) do
    case CMS.CommunityApplications.events(application, args) do
      {:ok, page} -> {:ok, connection(page.entries, page.has_next_page, &event_cursor/1)}
      error -> application_result(error)
    end
  end

  def application_actor_ref(actor, _args, _info) do
    {:ok, actor.login}
  end

  def application_community_ref(community, _args, _info) do
    {:ok, community.slug}
  end

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

  def application_event_actor(event, _args, _info) do
    CMS.CommunityApplications.event_actor(event) |> application_result()
  end

  def community_application_logo_origin_info(_root, %{public_ref: public_ref}, _info) do
    CMS.CommunityApplications.logo_origin(public_ref) |> application_result()
  end

  defp connection(entries, has_next_page, cursor_fun) do
    edges =
      Enum.map(entries, fn entry -> %{cursor: opaque_cursor(cursor_fun.(entry)), node: entry} end)

    %{
      edges: edges,
      page_info: %{
        end_cursor:
          edges
          |> List.last()
          |> then(
            &if &1 do
              &1.cursor
            else
              nil
            end
          ),
        has_next_page: has_next_page
      }
    }
  end

  defp application_cursor(application) do
    "#{DateTime.to_iso8601(application.submitted_at)}|#{application.public_ref}"
  end

  defp event_cursor(event), do: "#{DateTime.to_iso8601(event.occurred_at)}|#{event.id}"

  defp application_result({:ok, value}) do
    {:ok, value}
  end

  defp application_result({:error, reason}) do
    reason_code = reason |> normalize_reason() |> Atom.to_string()

    {:error,
     message: reason_code,
     extensions: %{code: ErrorCat.code(ErrorCat.custom()), reasonCode: reason_code}}
  end

  defp opaque_cursor(value) do
    value |> to_string() |> Base.url_encode64(padding: false)
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
