defmodule GroupherServer.CMS.Communities.Setup do
  @moduledoc """
  Idempotent initialization and recovery for a newly created Community.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Setup
        -> Repo / Oban
  """

  require GroupherServer.CMS.Gate.Const
  require GroupherServer.CMS.Communities.Const
  require GroupherServer.CMS.Communities.ErrorCat

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Analysis, CMS, Repo, ReviewBot}
  alias Ecto.Multi
  alias Accounts.Model.User
  alias CMS.Communities.{ErrorCat, Lifecycle}
  alias CMS.Communities.Moderators.Setup, as: ModeratorSetup

  alias CMS.CommunityApplications.Lifecycle, as: ApplicationLifecycle
  alias CMS.Gate.Const
  alias CMS.Passport

  alias CMS.Model.{
    Community,
    CommunityApplication,
    CommunityApplicationEvent,
    CommunityModerator
  }

  @community_normal CMS.Communities.Const.pending_state(:normal)

  @doc """
  Runs idempotent initialization for a newly created Community.

  Fetches the community, its application and the owner, ensures the owner is
  the root moderator, initializes the doc tree and analysis provisioning,
  then activates the community.

  ## Examples

      CMS.Communities.Setup.run("groupher", "op_123")
      #=> {:ok, %CommunityApplication{}}

  """
  @spec run(String.t(), String.t()) :: {:ok, CommunityApplication.t()} | {:error, term()}
  def run(community_ref, operation_ref) do
    with {:ok, community} <- fetch_community(community_ref),
         {:ok, application} <- fetch_application(community.id) do
      case setup_operation_status(application, operation_ref) do
        {:ok, :current} ->
          with {:ok, user} <- fetch_user(application.user_id),
               {:ok, :current} <- ensure_current_operation(application, operation_ref),
               {:ok, _} <- ensure_root(community, user),
               {:ok, :current} <- ensure_current_operation(application, operation_ref),
               {:ok, _state} <- CMS.DocTree.initialize(community),
               {:ok, :current} <- ensure_current_operation(application, operation_ref),
               {:ok, _} <- ensure_analysis(community) do
            activate(community, application, operation_ref)
          end

        {:ok, :complete} ->
          {:ok, application}

        {:ok, :obsolete} ->
          {:ok, application}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @spec retry(String.t(), User.t(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def retry(application_ref, %User{} = reviewer, expected_version, command_id \\ nil) do
    with {:ok, _} <-
           review_authorized?(reviewer, Const.passport_action(:community_application_retry_setup)) do
      operation_ref = workflow_ref("community_setup", command_id)
      now = DateTime.utc_now(:second)

      Repo.transaction(fn ->
        application = lock_application(application_ref)

        cond do
          is_nil(application) ->
            Repo.rollback(ErrorCat.application_not_found())

          application.version != expected_version ->
            Repo.rollback(ErrorCat.application_state_conflict())

          true ->
            case Lifecycle.transition(
                   application.community_id,
                   :setting_up,
                   operation_ref: operation_ref,
                   audit_action: "community.setup_retried",
                   attrs: %{failed_at: nil, last_error: nil}
                 ) do
              {:ok, _lifecycle} ->
                Multi.new()
                |> ApplicationLifecycle.add(
                  :application,
                  :event,
                  application,
                  :setting_up,
                  %{last_job_error: nil, setup_started_at: now},
                  %{
                    type: :reviewer,
                    id: reviewer.id,
                    operation_ref: operation_ref,
                    occurred_at: now
                  }
                )
                |> Multi.insert(
                  :setup_job,
                  GroupherServer.Jobs.community_setup_new(%{
                    community_ref: application.slug,
                    application_ref: application.public_ref,
                    operation_ref: operation_ref
                  })
                )
                |> Repo.transaction()
                |> case do
                  {:ok, %{application: application}} ->
                    application

                  {:error, :application, %Ecto.Changeset{}, _changes} ->
                    Repo.rollback(ErrorCat.active_application_exists())

                  {:error, _step, reason, _changes} ->
                    Repo.rollback(reason)
                end

              {:error, reason} ->
                Repo.rollback(reason)
            end
        end
      end)
    end
  end

  @spec mark_failed(String.t(), String.t(), term(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def mark_failed(application_ref, operation_ref, reason, attempt) do
    now = DateTime.utc_now(:second)
    error = job_error(reason, operation_ref, now, attempt)

    Repo.transaction(fn ->
      application = lock_application(application_ref)

      cond do
        is_nil(application) ->
          Repo.rollback(ErrorCat.application_not_found())

        setup_operation_status(application, operation_ref) == {:ok, :obsolete} ->
          application

        application.status == :setup_failed ->
          application

        application.status != :setting_up ->
          Repo.rollback(ErrorCat.application_state_conflict())

        true ->
          case Lifecycle.transition(
                 application.community_id,
                 :setup_failed,
                 operation_ref: operation_ref,
                 audit_action: "community.setup_failed",
                 attrs: %{failed_at: now, last_error: error}
               ) do
            {:ok, _lifecycle} ->
              Multi.new()
              |> ApplicationLifecycle.add(
                :application,
                :event,
                application,
                :setup_failed,
                %{last_job_error: error},
                %{
                  type: :job,
                  operation_ref: operation_ref,
                  reason_code: "community_setup_failed",
                  metadata: %{"worker" => "Setup", "attempt" => attempt},
                  occurred_at: now
                }
              )
              |> Repo.transaction()
              |> case do
                {:ok, %{application: application}} -> application
                {:error, _step, reason, _changes} -> Repo.rollback(reason)
              end

            {:error, reason} ->
              Repo.rollback(reason)
          end
      end
    end)
  end

  defp activate(community, _application, operation_ref) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      application =
        CommunityApplication
        |> where([application], application.community_id == ^community.id)
        |> lock("FOR UPDATE")
        |> Repo.one!()

      cond do
        application.status == :created ->
          application

        setup_operation_status(application, operation_ref) != {:ok, :current} ->
          application

        application.status != :setting_up ->
          Repo.rollback(ErrorCat.application_state_conflict())

        true ->
          case ReviewBot.create_default_configs_for_community(community.id) do
            {:ok, _configs} -> {:ok, :pass}
            {:error, reason} -> Repo.rollback(reason)
          end

          case Lifecycle.transition(
                 community.id,
                 :active,
                 operation_ref: operation_ref,
                 audit_action: "community.activated",
                 attrs: %{activated_at: now, failed_at: nil, last_error: nil}
               ) do
            {:ok, _lifecycle} ->
              Multi.new()
              |> ApplicationLifecycle.add(
                :application,
                :event,
                application,
                :created,
                %{completed_at: now, last_job_error: nil},
                %{
                  type: :job,
                  operation_ref: operation_ref,
                  metadata: %{"worker" => "Setup"},
                  occurred_at: now
                }
              )
              |> Multi.update(
                :community,
                Community.update_changeset(community, %{pending: @community_normal})
              )
              |> Repo.transaction()
              |> case do
                {:ok, %{application: application}} -> application
                {:error, _step, reason, _changes} -> Repo.rollback(reason)
              end

            {:error, reason} ->
              Repo.rollback(reason)
          end
      end
    end)
  end

  defp ensure_root(community, user) do
    case Repo.transaction(fn -> ensure_root_locked(community, user) end) do
      {:ok, :pass} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_root_locked(community, user) do
    community = lock_community(community.id)

    if root_moderator?(community, user) do
      :pass
    else
      add_root_moderator(community, user)
    end
  end

  defp root_moderator?(community, user) do
    Repo.exists?(
      from(moderator in CommunityModerator,
        where: moderator.community_id == ^community.id and moderator.user_id == ^user.id
      )
    )
  end

  defp add_root_moderator(community, user) do
    case ModeratorSetup.add_root(community, user) do
      {:ok, _} -> :pass
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  defp lock_community(community_id) do
    Community
    |> where([community], community.id == ^community_id)
    |> lock("FOR UPDATE")
    |> Repo.one!()
  end

  defp ensure_analysis(community) do
    case Analysis.web_provision_community_on_create(community) do
      {:ok, _} -> {:ok, :pass}
      {:error, ErrorCat.error_pattern(reason: :not_configured)} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end

  defp fetch_community(slug) do
    case Repo.get_by(Community, slug: slug) do
      nil -> {:error, ErrorCat.application_not_found()}
      community -> {:ok, community}
    end
  end

  defp fetch_application(community_id) do
    case Repo.get_by(CommunityApplication, community_id: community_id) do
      nil -> {:error, ErrorCat.application_not_found()}
      application -> {:ok, application}
    end
  end

  defp fetch_user(user_id) do
    case Repo.get(User, user_id) do
      nil -> {:error, ErrorCat.application_not_found()}
      user -> {:ok, user}
    end
  end

  defp lock_application(public_ref) do
    CommunityApplication
    |> where([application], application.public_ref == ^public_ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp ensure_current_operation(application, operation_ref) do
    case setup_operation_status(application, operation_ref) do
      {:ok, :current} -> {:ok, :current}
      {:ok, _status} -> {:error, ErrorCat.application_state_conflict()}
      {:error, reason} -> {:error, reason}
    end
  end

  defp setup_operation_status(%CommunityApplication{status: :created}, _operation_ref) do
    {:ok, :complete}
  end

  defp setup_operation_status(
         %CommunityApplication{status: :setting_up} = application,
         operation_ref
       ) do
    current_operation =
      CommunityApplicationEvent
      |> where(
        [event],
        event.application_id == ^application.id and event.to_status == :setting_up
      )
      |> order_by([event], desc: event.occurred_at, desc: event.id)
      |> limit(1)
      |> select([event], event.operation_ref)
      |> Repo.one()

    case current_operation do
      ^operation_ref -> {:ok, :current}
      nil -> {:error, ErrorCat.application_state_conflict()}
      _other -> {:ok, :obsolete}
    end
  end

  defp setup_operation_status(_application, _operation_ref) do
    {:error, ErrorCat.application_state_conflict()}
  end

  defp job_error(reason, operation_ref, now, attempt) do
    %{
      "reason_code" => "community_setup_failed",
      "message" => inspect(reason),
      "operation_ref" => operation_ref,
      "occurred_at" => DateTime.to_iso8601(now),
      "attempt" => attempt
    }
  end

  defp review_authorized?(reviewer, action) do
    case Passport.check(reviewer, action, %{}) do
      {:ok, true} -> {:ok, :pass}
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end

  defp workflow_ref(_kind, command_id) when is_binary(command_id), do: command_id

  defp workflow_ref(_kind, _command_id), do: Ecto.UUID.generate()
end
