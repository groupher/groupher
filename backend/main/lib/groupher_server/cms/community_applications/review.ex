defmodule GroupherServer.CMS.CommunityApplications.Review do
  @moduledoc """
  Reviewer decisions and recovery transitions for community applications.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Review
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.{NamePolicy, SlugClaims}
  alias GroupherServer.CMS.{Const, CommunityApplications.Transitions}
  alias GroupherServer.CMS.Gate.Passport
  alias GroupherServer.CMS.CommunityApplications.Jobs.CreateCommunity
  alias GroupherServer.CMS.Model.CommunityApplication
  alias GroupherServer.Repo

  require Const

  @spec start(String.t(), User.t(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def start(public_ref, %User{} = reviewer, expected_version) do
    with :ok <- review_authorized?(reviewer, Const.passport_action(:community_application_review)) do
      transition(public_ref, reviewer, expected_version, :reviewing, %{expires_at: nil}, fn multi,
                                                                                            application,
                                                                                            now ->
        SlugClaims.clear_expiry(multi, :claim, application, now)
      end)
    end
  end

  @spec approve(String.t(), User.t(), integer(), map()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def approve(public_ref, %User{} = reviewer, expected_version, metadata) do
    with :ok <-
           review_authorized?(reviewer, Const.passport_action(:community_application_approve)) do
      operation_ref = Ecto.UUID.generate()

      transition(
        public_ref,
        reviewer,
        expected_version,
        :approved,
        %{
          review_metadata: metadata,
          reviewed_at: DateTime.utc_now(:second),
          reviewer_id: reviewer.id
        },
        fn multi, application, _now ->
          Multi.insert(
            multi,
            :create_community_job,
            CreateCommunity.new(%{
              application_ref: application.public_ref,
              operation_ref: operation_ref
            })
          )
        end,
        operation_ref
      )
    end
  end

  @spec reject(String.t(), User.t(), integer(), map()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def reject(public_ref, %User{} = reviewer, expected_version, reason) do
    with :ok <- review_authorized?(reviewer, Const.passport_action(:community_application_reject)) do
      now = DateTime.utc_now(:second)

      transition(
        public_ref,
        reviewer,
        expected_version,
        :rejected,
        %{
          reviewed_at: now,
          reviewer_id: reviewer.id,
          decision_reason_code: Map.get(reason, :reason_code),
          decision_note: Map.get(reason, :note),
          expires_at: nil
        },
        fn multi, application, _now ->
          SlugClaims.release_application(multi, :claim, application, now)
        end
      )
    end
  end

  @spec retry_creation(String.t(), User.t(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def retry_creation(public_ref, %User{} = reviewer, expected_version) do
    with :ok <-
           review_authorized?(
             reviewer,
             Const.passport_action(:community_application_retry_creation)
           ),
         {:ok, application} <- fetch(public_ref),
         {:ok, _slug} <- NamePolicy.check(application.slug, ignore_application_id: application.id) do
      operation_ref = Ecto.UUID.generate()

      transition(
        public_ref,
        reviewer,
        expected_version,
        :approved,
        %{last_job_error: nil, reviewer_id: reviewer.id},
        fn multi, _application, _now ->
          multi
          |> SlugClaims.insert_application(:claim, :application, nil)
          |> Multi.insert(
            :create_community_job,
            CreateCommunity.new(%{
              application_ref: application.public_ref,
              operation_ref: operation_ref
            })
          )
        end,
        operation_ref
      )
    end
  end

  @spec mark_creation_failed(String.t(), String.t(), term()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def mark_creation_failed(public_ref, operation_ref, reason) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      with {:ok, application} <- lock(public_ref) do
        if application.status == :creation_failed do
          application
        else
          Multi.new()
          |> Transitions.add(
            :application,
            :event,
            application,
            :creation_failed,
            %{
              last_job_error: job_error(reason, operation_ref, now),
              expires_at: nil
            },
            %{
              type: :job,
              operation_ref: operation_ref,
              reason_code: "community_creation_failed",
              metadata: %{"worker" => "CreateCommunity"},
              occurred_at: now
            }
          )
          |> SlugClaims.release_application(:claim, application, now)
          |> Repo.transaction()
          |> unwrap_nested_transaction()
        end
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp transition(
         public_ref,
         reviewer,
         expected_version,
         to,
         attrs,
         extend_multi,
         operation_ref \\ nil
       ) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      with {:ok, application} <- lock(public_ref),
           :ok <- expected_version(application, expected_version) do
        Multi.new()
        |> Transitions.add(:application, :event, application, to, attrs, %{
          type: :reviewer,
          id: reviewer.id,
          operation_ref: operation_ref,
          occurred_at: now
        })
        |> extend_multi.(application, now)
        |> Repo.transaction()
        |> unwrap_nested_transaction()
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> normalize_transaction_result()
  end

  defp fetch(public_ref) do
    case Repo.get_by(CommunityApplication, public_ref: public_ref) do
      nil -> {:error, :application_not_found}
      application -> {:ok, application}
    end
  end

  defp lock(public_ref) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref,
             lock: "FOR UPDATE"
           )
         ) do
      nil -> {:error, :application_not_found}
      application -> {:ok, application}
    end
  end

  defp expected_version(%{version: version}, version), do: :ok
  defp expected_version(_, _), do: {:error, :application_state_conflict}

  defp unwrap_nested_transaction({:ok, %{application: application}}), do: application

  defp unwrap_nested_transaction({:error, :claim, %Ecto.Changeset{}, _changes}),
    do: Repo.rollback(:slug_claimed)

  defp unwrap_nested_transaction({:error, :application, %Ecto.Changeset{}, _changes}),
    do: Repo.rollback(:active_application_exists)

  defp unwrap_nested_transaction({:error, _step, reason, _changes}), do: Repo.rollback(reason)

  defp normalize_transaction_result({:ok, application}), do: {:ok, application}

  defp normalize_transaction_result({:error, reason}), do: {:error, reason}

  defp job_error(reason, operation_ref, now) do
    %{
      "reason_code" => "community_creation_failed",
      "message" => inspect(reason),
      "operation_ref" => operation_ref,
      "occurred_at" => DateTime.to_iso8601(now)
    }
  end

  defp review_authorized?(reviewer, action) do
    case Passport.check(reviewer, action, %{}) do
      {:ok, true} -> :ok
      _ -> {:error, :review_permission_denied}
    end
  end
end
