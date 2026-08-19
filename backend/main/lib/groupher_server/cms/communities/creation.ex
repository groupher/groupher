defmodule GroupherServer.CMS.Communities.Creation do
  @moduledoc """
  Atomic Community identity creation from one approved Application.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Creation
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.{Lifecycle, NamePolicy, SlugClaims, Writer}
  alias GroupherServer.CMS.Communities.ErrorCat
  alias GroupherServer.CMS.CommunityApplications.Transitions
  alias GroupherServer.CMS.Communities.Jobs.Setup

  alias GroupherServer.CMS.Model.{
    CommunityApplication,
    CommunityApplicationLogoUpload
  }

  alias Helper.Constant

  @community_applying Constant.CMS.pending(:applying)

  @doc """
  Creates a Community from one approved Application inside a single transaction.

  The application is locked and must be `:approved` (or already in the
  `:setting_up` / `:created` / `:setup_failed` states). Core creation, lifecycle,
  asset promotion, slug claim promotion and the idempotent Setup job enqueue
  all happen in the same transaction; any failure rolls back.

  ## Examples

      CMS.Communities.create_from_application("capp_abc", "op_123")
      #=> {:ok, %CommunityApplication{}}

  """
  @spec create_from_application(String.t(), String.t()) :: {:ok, term()} | {:error, term()}
  def create_from_application(application_ref, operation_ref) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      application = lock_application(application_ref)

      cond do
        is_nil(application) ->
          Repo.rollback(ErrorCat.application_not_found())

        application.status in [:setting_up, :created, :setup_failed] and application.community_id ->
          application

        application.status != :approved ->
          Repo.rollback(ErrorCat.application_state_conflict())

        true ->
          with {:ok, _slug} <-
                 NamePolicy.check(application.slug, ignore_application_id: application.id),
               {:ok, user} <- fetch_user(application.user_id),
               {:ok, upload} <- finalized_upload(application),
               {:ok, community} <- create_core(application, upload, user),
               {:ok, _lifecycle} <- create_lifecycle(community, application),
               {:ok, asset} <-
                 CMS.Assets.register_from_application_upload(community, upload, user),
               {:ok, _upload} <- mark_upload_promoted(upload, asset, now),
               {:ok, transitioned} <-
                 mark_setting_up(application, community, operation_ref, now),
               {:ok, _claim} <- promote_claim(application, community, now),
               {:ok, _job} <- enqueue_setup(community, application, operation_ref) do
            transitioned
          else
            {:error, reason} -> Repo.rollback(reason)
          end
      end
    end)
  end

  defp lock_application(public_ref) do
    CommunityApplication
    |> where([application], application.public_ref == ^public_ref)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp finalized_upload(application) do
    case Repo.get_by(CommunityApplicationLogoUpload,
           application_id: application.id,
           public_ref: application.logo_asset_ref,
           status: :finalized
         ) do
      nil -> {:error, ErrorCat.asset_not_ready()}
      upload -> {:ok, upload}
    end
  end

  defp fetch_user(user_id) do
    case Repo.get(User, user_id) do
      nil -> {:error, ErrorCat.application_not_found()}
      user -> {:ok, user}
    end
  end

  defp create_core(application, upload, user) do
    Writer.create_core(
      %{
        title: application.title,
        slug: application.slug,
        desc: application.desc,
        logo: upload.url,
        locale: application.locale,
        pending: @community_applying
      },
      user
    )
  end

  defp create_lifecycle(community, application) do
    Lifecycle.initial_changeset(%{
      community_id: community.id,
      application_id: application.id
    })
    |> Repo.insert()
  end

  defp mark_upload_promoted(upload, asset, now) do
    upload
    |> CommunityApplicationLogoUpload.changeset(%{
      status: :promoted,
      community_asset_id: asset.id,
      promoted_at: now
    })
    |> Repo.update()
  end

  defp mark_setting_up(application, community, operation_ref, now) do
    Multi.new()
    |> Transitions.add(
      :application,
      :event,
      application,
      :setting_up,
      %{community_id: community.id, setup_started_at: now, last_job_error: nil},
      %{
        type: :job,
        operation_ref: operation_ref,
        metadata: %{"worker" => "CreateCommunity"},
        occurred_at: now
      }
    )
    |> Repo.transaction()
    |> case do
      {:ok, %{application: application}} -> {:ok, application}
      {:error, _step, reason, _changes} -> {:error, reason}
    end
  end

  defp promote_claim(application, community, now) do
    Multi.new()
    |> Multi.run(:application, fn _, _ -> {:ok, application} end)
    |> Multi.run(:community, fn _, _ -> {:ok, community} end)
    |> SlugClaims.promote(:claim, application, :community, now)
    |> Repo.transaction()
    |> case do
      {:ok, %{claim: {1, _}}} -> {:ok, :promoted}
      {:ok, %{claim: {0, _}}} -> {:error, ErrorCat.slug_claimed()}
      {:error, _step, reason, _changes} -> {:error, reason}
    end
  end

  defp enqueue_setup(community, application, operation_ref) do
    %{
      community_ref: community.slug,
      application_ref: application.public_ref,
      operation_ref: operation_ref
    }
    |> Setup.new()
    |> Repo.insert()
  end
end
