defmodule GroupherServer.CMS.CommunityApplications.Query do
  @moduledoc """
  Owner and reviewer read models for community applications.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Query
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, FrontDesk, Repo}
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  alias Accounts.Model.User
  alias CMS.Communities.ErrorCat
  alias CMS.FrontDesk, as: CMSFrontDesk

  alias CMS.Model.{
    CommunityApplication,
    CommunityApplicationEvent,
    CommunityApplicationLogoUpload,
    CommunityAsset
  }

  @doc """
  Returns the user's most recent blocking application, if any.

  ## Examples

      CMS.CommunityApplications.Query.current(%User{id: 1})
      #=> {:ok, %CommunityApplication{}}

      CMS.CommunityApplications.Query.current(%User{id: 1})
      #=> {:ok, nil}

  """
  @spec current(User.t()) :: {:ok, CommunityApplication.t() | nil}
  def current(%User{id: user_id}) do
    statuses = CommunityApplication.blocking_statuses()

    application =
      CommunityApplication
      |> where([application], application.user_id == ^user_id and application.status in ^statuses)
      |> order_by([application], desc: application.updated_at)
      |> preload([:community, :logo_upload])
      |> Repo.one()

    {:ok, application}
  end

  @doc """
  Checks whether one user has a blocking Application without loading the row.

  ## Examples

      Query.active_application_exists(user.id)
      #=> {:ok, false}
  """
  @spec active_application_exists(integer()) :: {:ok, boolean()} | {:error, term()}
  def active_application_exists(user_id) when is_integer(user_id) do
    statuses = CommunityApplication.blocking_statuses()

    {:ok,
     Repo.exists?(
       from(application in CommunityApplication,
         where: application.user_id == ^user_id and application.status in ^statuses
       )
     )}
  rescue
    error -> {:error, error}
  end

  @doc """
  Returns the user's most recent failed Application, if any.

  ## Examples

      Query.latest_failed(%User{id: 1})
      #=> {:ok, %CommunityApplication{}} | {:ok, nil}
  """
  @spec latest_failed(User.t()) :: {:ok, CommunityApplication.t() | nil}
  def latest_failed(%User{id: user_id}) do
    statuses = CommunityApplication.failed_statuses()

    application =
      CommunityApplication
      |> where([application], application.user_id == ^user_id and application.status in ^statuses)
      |> order_by([application], desc: application.updated_at, desc: application.id)
      |> limit(1)
      |> Repo.one()

    {:ok, application}
  end

  @doc """
  Returns a user's paginated application history, newest first.

  ## Examples

      Query.history(%User{id: 1}, %Pagi{})
      #=> {:ok, %Pagi{entries: [%CommunityApplication{}]}}
  """
  @spec history(User.t(), term()) :: {:ok, struct()} | {:error, term()}
  def history(%User{id: user_id}, pagi) do
    query =
      from(application in CommunityApplication,
        where: application.user_id == ^user_id,
        preload: [:community, :logo_upload]
      )

    ORM.pagi(query, pagi,
      for: CommunityApplication,
      order: %Order{
        fields: [:updated_at, :id],
        directions: [:desc, :desc],
        cursor_fields: [:updated_at, :id]
      },
      surface: "community_applications.history",
      query_fingerprint: to_string(user_id)
    )
  end

  @doc """
  Loads an Application by public reference only when it belongs to the user.

  ## Examples

      Query.owned("application-ref", %User{id: 1})
      #=> {:ok, %CommunityApplication{}}
  """
  @spec owned(String.t(), User.t()) ::
          {:ok, CommunityApplication.t()} | {:error, ErrorCat.error()}
  def owned(public_ref, %User{id: user_id}) when is_binary(public_ref) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref and application.user_id == ^user_id,
             preload: [:community, :logo_upload]
           )
         ) do
      nil -> {:error, ErrorCat.application_not_found()}
      application -> {:ok, application}
    end
  end

  @doc """
  Loads an application with reviewer-facing associations for an authorized reviewer.

  Authorization is enforced by the `CommunityApplications` facade before this
  query is called.

  ## Examples

      Query.review_detail("application-ref")
      #=> {:ok, %CommunityApplication{}}
  """
  @spec review_detail(String.t()) ::
          {:ok, CommunityApplication.t()} | {:error, ErrorCat.error()}
  def review_detail(public_ref) when is_binary(public_ref) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref,
             preload: [:user, :reviewer, :community, :logo_upload]
           )
         ) do
      nil -> {:error, ErrorCat.application_not_found()}
      application -> {:ok, application}
    end
  end

  @doc """
  Returns the reviewer queue with the supported status, applicant, reviewer,
  slug, and submission-time filters.

  The public facade authorizes the reviewer before calling this query.

  ## Examples

      Query.review_queue(%{statuses: [:submitted]}, %Pagi{})
      #=> {:ok, %Pagi{entries: [%CommunityApplication{}]}}
  """
  @spec review_queue(map(), term()) :: {:ok, struct()} | {:error, term()}
  def review_queue(filter, pagi) when is_map(filter) do
    statuses = normalize_statuses(get(filter, :statuses, [])) |> Enum.sort()
    filter = Map.put(filter, :statuses, statuses)

    query =
      CommunityApplication
      |> maybe_statuses(statuses)
      |> maybe_eq(:user_id, get(filter, :applicant_id))
      |> maybe_eq(:reviewer_id, get(filter, :reviewer_id))
      |> maybe_eq(:slug, get(filter, :slug))
      |> maybe_datetime(:submitted_at, :>=, get(filter, :submitted_from))
      |> maybe_datetime(:submitted_at, :<=, get(filter, :submitted_to))
      |> preload([:reviewer])

    ORM.pagi(query, pagi,
      for: CommunityApplication,
      order: %Order{
        fields: [:submitted_at, :id],
        directions: [:asc, :asc],
        cursor_fields: [:submitted_at, :id]
      },
      surface: "community_applications.review_queue",
      query_fingerprint: Base.encode64(:erlang.term_to_binary(filter))
    )
  end

  @doc """
  Returns a paginated event history for an already loaded Application.

  ## Examples

      Query.events(%CommunityApplication{id: 1}, %Pagi{})
      #=> {:ok, %Pagi{entries: [%CommunityApplicationEvent{}]}}
  """
  @spec events(CommunityApplication.t(), term()) :: {:ok, struct()} | {:error, term()}
  def events(%CommunityApplication{id: application_id}, pagi) do
    query =
      from(event in CommunityApplicationEvent,
        where: event.application_id == ^application_id,
        preload: [:actor]
      )

    ORM.pagi(query, pagi,
      for: CommunityApplicationEvent,
      order: %Order{
        fields: [:occurred_at, :id],
        directions: [:asc, :asc],
        cursor_fields: [:occurred_at, :id]
      },
      surface: "community_applications.events",
      query_fingerprint: to_string(application_id)
    )
  end

  @doc """
  Loads the applicant for an Application result.

  ## Examples

      Query.applicant(%CommunityApplication{user_id: 1})
      #=> {:ok, %User{}}
  """
  @spec applicant(CommunityApplication.t()) :: {:ok, User.t()} | {:error, term()}
  def applicant(%CommunityApplication{user_id: user_id}), do: fetch_user(user_id)

  @doc """
  Loads the reviewer for an Application result, returning `nil` when it has not
  been assigned.

  ## Examples

      Query.reviewer(%CommunityApplication{reviewer_id: nil})
      #=> {:ok, nil}
  """
  @spec reviewer(CommunityApplication.t()) :: {:ok, User.t() | nil} | {:error, term()}
  def reviewer(%CommunityApplication{reviewer_id: nil}), do: {:ok, nil}
  def reviewer(%CommunityApplication{reviewer_id: reviewer_id}), do: fetch_user(reviewer_id)

  @doc """
  Loads the related Community for an Application result, returning `nil` before
  community creation.

  ## Examples

      Query.community(%CommunityApplication{community_id: nil})
      #=> {:ok, nil}
  """
  @spec community(CommunityApplication.t()) :: {:ok, struct() | nil} | {:error, term()}
  def community(%CommunityApplication{community_id: nil}), do: {:ok, nil}

  def community(%CommunityApplication{community_id: community_id}) do
    CMSFrontDesk.community(community_id, mode: :internal)
  end

  @doc """
  Loads the actor for an event, returning `nil` for system-generated events.

  ## Examples

      Query.event_actor(%CommunityApplicationEvent{actor_id: nil})
      #=> {:ok, nil}
  """
  @spec event_actor(CommunityApplicationEvent.t()) :: {:ok, User.t() | nil} | {:error, term()}
  def event_actor(%CommunityApplicationEvent{actor_id: nil}), do: {:ok, nil}
  def event_actor(%CommunityApplicationEvent{actor_id: actor_id}), do: fetch_user(actor_id)

  @doc """
  Returns the upload reference, promoted asset reference, and URL for an
  Application logo.

  ## Examples

      Query.logo(%CommunityApplication{id: 1, logo_asset_ref: "upload-ref"})
      #=> {:ok, %{application_upload_ref: "upload-ref", community_asset_ref: nil, url: "https://..."}}
  """
  @spec logo(CommunityApplication.t()) :: {:ok, map()} | {:error, ErrorCat.error()}
  def logo(%CommunityApplication{id: application_id, logo_asset_ref: upload_ref}) do
    case Repo.get_by(CommunityApplicationLogoUpload,
           application_id: application_id,
           public_ref: upload_ref
         ) do
      nil ->
        {:error, ErrorCat.asset_not_found()}

      upload ->
        community_asset_ref =
          case upload.community_asset_id do
            nil ->
              nil

            asset_id ->
              Repo.get(CommunityAsset, asset_id) |> then(&if(&1, do: &1.public_ref, else: nil))
          end

        {:ok,
         %{
           application_upload_ref: upload.public_ref,
           community_asset_ref: community_asset_ref,
           url: upload.url
         }}
    end
  end

  @doc """
  Finds a finalized or promoted upload by public reference.

  ## Examples

      Query.logo_origin("upload-ref")
      #=> {:ok, %CommunityApplicationLogoUpload{}} | {:ok, nil}
  """
  @spec logo_origin(String.t()) :: {:ok, CommunityApplicationLogoUpload.t() | nil}
  def logo_origin(public_ref) when is_binary(public_ref) do
    case Repo.one(
           from(upload in CommunityApplicationLogoUpload,
             where: upload.public_ref == ^public_ref and upload.status in [:finalized, :promoted]
           )
         ) do
      nil -> {:ok, nil}
      upload -> {:ok, upload}
    end
  end

  defp maybe_statuses(query, []), do: query

  defp maybe_statuses(query, statuses) do
    where(query, [application], application.status in ^statuses)
  end

  defp maybe_eq(query, _field, nil), do: query

  defp maybe_eq(query, field, value) do
    where(query, [application], field(application, ^field) == ^value)
  end

  defp maybe_datetime(query, _field, _operator, nil), do: query

  defp maybe_datetime(query, field, :>=, value) do
    where(query, [application], field(application, ^field) >= ^value)
  end

  defp maybe_datetime(query, field, :<=, value) do
    where(query, [application], field(application, ^field) <= ^value)
  end

  defp normalize_statuses(statuses) when is_list(statuses) do
    allowed = CommunityApplication.statuses()
    Enum.filter(statuses, &(&1 in allowed))
  end

  defp normalize_statuses(_), do: []

  defp fetch_user(id), do: FrontDesk.user(id)

  defp get(map, key, default \\ nil) do
    Map.get(map, key, Map.get(map, Atom.to_string(key), default))
  end

  @doc """
  Loads an Application by public reference or internal database ID.

  This lookup is used by Community Application Commands to resolve targets and
  recover command results. Product reads should use the public facade, which
  applies ownership or reviewer authorization.

  ## Examples

      Query.application("application-ref")
      #=> %CommunityApplication{} | nil
  """
  @spec application(String.t() | integer()) :: CommunityApplication.t() | nil
  def application(public_ref) when is_binary(public_ref) do
    Repo.get_by(CommunityApplication, public_ref: public_ref)
  end

  def application(id), do: Repo.get(CommunityApplication, id)

  @doc """
  Looks up the Application recorded for one submit command identity.

  This is an internal idempotency query used by the submit Command; it is not a
  product-facing lookup.

  ## Examples

      Query.by_submit_command(1, "command-id")
      #=> %CommunityApplication{} | nil
  """
  @spec by_submit_command(integer(), String.t()) :: CommunityApplication.t() | nil
  def by_submit_command(user_id, key) do
    Repo.get_by(CommunityApplication, user_id: user_id, submit_command_id: key)
  end
end
