defmodule GroupherServer.CMS.Communities.Setup do
  @moduledoc """
  Idempotent initialization and recovery for a newly created Community.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Setup
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.{Analysis, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.{Lifecycle, Moderator}
  alias GroupherServer.CMS.Communities.ErrorCat
  alias GroupherServer.CMS.{CommunityApplications.Transitions, Const}
  alias GroupherServer.CMS.Passport
  alias GroupherServer.CMS.Communities.Jobs.Setup, as: SetupJob

  alias GroupherServer.CMS.Model.{
    Community,
    CommunityApplication,
    CommunityModerator
  }

  alias Helper.Constant

  require Const

  @community_normal Constant.CMS.pending(:normal)

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
         {:ok, application} <- fetch_application(community.id),
         {:ok, user} <- fetch_user(application.user_id),
         :ok <- ensure_root(community, user),
         {:ok, _state} <- CMS.DocTree.initialize(community),
         :ok <- ensure_analysis(community) do
      activate(community, application, operation_ref)
    end
  end

  @spec retry(String.t(), User.t(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def retry(application_ref, %User{} = reviewer, expected_version) do
    with :ok <-
           review_authorized?(reviewer, Const.passport_action(:community_application_retry_setup)) do
      operation_ref = Ecto.UUID.generate()
      now = DateTime.utc_now(:second)

      Repo.transaction(fn ->
        application = lock_application(application_ref)

        cond do
          is_nil(application) ->
            Repo.rollback(ErrorCat.application_not_found())

          application.version != expected_version ->
            Repo.rollback(ErrorCat.application_state_conflict())

          true ->
            with {:ok, _lifecycle} <-
                   Lifecycle.transition(
                     application.community_id,
                     :setting_up,
                     operation_ref: operation_ref,
                     audit_action: "community.setup_retried",
                     attrs: %{failed_at: nil, last_error: nil}
                   ) do
              Multi.new()
              |> Transitions.add(
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
                SetupJob.new(%{
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
            else
              {:error, reason} -> Repo.rollback(reason)
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

        application.status == :setup_failed ->
          application

        application.status != :setting_up ->
          Repo.rollback(ErrorCat.application_state_conflict())

        true ->
          with {:ok, _lifecycle} <-
                 Lifecycle.transition(
                   application.community_id,
                   :setup_failed,
                   operation_ref: operation_ref,
                   audit_action: "community.setup_failed",
                   attrs: %{failed_at: now, last_error: error}
                 ) do
            Multi.new()
            |> Transitions.add(
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
          else
            {:error, reason} -> Repo.rollback(reason)
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

        application.status != :setting_up ->
          Repo.rollback(ErrorCat.application_state_conflict())

        true ->
          with {:ok, _lifecycle} <-
                 Lifecycle.transition(
                   community.id,
                   :active,
                   operation_ref: operation_ref,
                   audit_action: "community.activated",
                   attrs: %{activated_at: now, failed_at: nil, last_error: nil}
                 ) do
            Multi.new()
            |> Transitions.add(
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
          else
            {:error, reason} -> Repo.rollback(reason)
          end
      end
    end)
  end

  defp ensure_root(community, user) do
    if Repo.exists?(
         from(moderator in CommunityModerator,
           where: moderator.community_id == ^community.id and moderator.user_id == ^user.id
         )
       ) do
      :ok
    else
      case Moderator.add_root(community, user) do
        {:ok, _} -> :ok
        {:error, reason} -> {:error, reason}
      end
    end
  end

  defp ensure_analysis(community) do
    case Analysis.Web.provision_community(community) do
      {:ok, _} -> :ok
      {:error, %GroupherServer.ErrorCat.Error{reason: :not_configured}} -> :ok
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
      {:ok, true} -> :ok
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end
end
