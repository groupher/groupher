defmodule GroupherServer.CMS.CommunityApplications.Read do
  @moduledoc """
  Owner and reviewer read models for community applications.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Read
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User

  alias GroupherServer.CMS.Model.{
    Community,
    CommunityApplication,
    CommunityApplicationEvent,
    CommunityApplicationLogoUpload,
    CommunityAsset
  }

  alias GroupherServer.Repo

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

  @spec history(User.t(), map()) :: {:ok, map()}
  def history(%User{id: user_id}, filter \\ %{}) do
    first = filter |> get(:first, 20) |> min(100) |> max(1)

    entries =
      CommunityApplication
      |> where([application], application.user_id == ^user_id)
      |> order_by([application], desc: application.updated_at, desc: application.id)
      |> limit(^(first + 1))
      |> preload([:community, :logo_upload])
      |> Repo.all()

    {:ok, %{entries: Enum.take(entries, first), has_next_page: length(entries) > first}}
  end

  @spec owned(String.t(), User.t()) :: {:ok, CommunityApplication.t()} | {:error, atom()}
  def owned(public_ref, %User{id: user_id}) when is_binary(public_ref) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref and application.user_id == ^user_id,
             preload: [:community, :logo_upload]
           )
         ) do
      nil -> {:error, :application_not_found}
      application -> {:ok, application}
    end
  end

  @spec review_detail(String.t()) :: {:ok, CommunityApplication.t()} | {:error, atom()}
  def review_detail(public_ref) when is_binary(public_ref) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref,
             preload: [:user, :reviewer, :community, :logo_upload]
           )
         ) do
      nil -> {:error, :application_not_found}
      application -> {:ok, application}
    end
  end

  @spec review_queue(map()) :: {:ok, map()}
  def review_queue(filter) when is_map(filter) do
    first = filter |> get(:first, 20) |> min(100) |> max(1)
    statuses = normalize_statuses(get(filter, :statuses, []))
    after_cursor = decode_application_cursor(get(filter, :after))

    query =
      CommunityApplication
      |> maybe_statuses(statuses)
      |> maybe_eq(:user_id, get(filter, :applicant_id))
      |> maybe_eq(:reviewer_id, get(filter, :reviewer_id))
      |> maybe_eq(:slug, get(filter, :slug))
      |> maybe_datetime(:submitted_at, :>=, get(filter, :submitted_from))
      |> maybe_datetime(:submitted_at, :<=, get(filter, :submitted_to))
      |> maybe_after_application(after_cursor)
      |> order_by([application], asc: application.submitted_at, asc: application.public_ref)
      |> limit(^(first + 1))
      |> preload([:reviewer])

    entries = Repo.all(query)

    {:ok,
     %{
       entries: Enum.take(entries, first),
       has_next_page: length(entries) > first
     }}
  end

  @spec events(CommunityApplication.t(), map()) :: {:ok, map()}
  def events(%CommunityApplication{id: application_id}, filter \\ %{}) do
    first = filter |> get(:first, 100) |> min(100) |> max(1)
    after_cursor = decode_event_cursor(get(filter, :after))

    entries =
      CommunityApplicationEvent
      |> where([event], event.application_id == ^application_id)
      |> maybe_after_event(after_cursor)
      |> order_by([event], asc: event.occurred_at, asc: event.inserted_at, asc: event.id)
      |> limit(^(first + 1))
      |> preload([:actor])
      |> Repo.all()

    {:ok, %{entries: Enum.take(entries, first), has_next_page: length(entries) > first}}
  end

  def applicant(%CommunityApplication{user_id: user_id}), do: fetch(User, user_id)
  def reviewer(%CommunityApplication{reviewer_id: nil}), do: {:ok, nil}
  def reviewer(%CommunityApplication{reviewer_id: reviewer_id}), do: fetch(User, reviewer_id)
  def community(%CommunityApplication{community_id: nil}), do: {:ok, nil}

  def community(%CommunityApplication{community_id: community_id}),
    do: fetch(Community, community_id)

  def event_actor(%CommunityApplicationEvent{actor_id: nil}), do: {:ok, nil}
  def event_actor(%CommunityApplicationEvent{actor_id: actor_id}), do: fetch(User, actor_id)

  def logo(%CommunityApplication{id: application_id, logo_asset_ref: upload_ref}) do
    case Repo.get_by(CommunityApplicationLogoUpload,
           application_id: application_id,
           public_ref: upload_ref
         ) do
      nil ->
        {:error, :asset_not_found}

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

  defp maybe_statuses(query, statuses),
    do: where(query, [application], application.status in ^statuses)

  defp maybe_eq(query, _field, nil), do: query

  defp maybe_eq(query, field, value),
    do: where(query, [application], field(application, ^field) == ^value)

  defp maybe_datetime(query, _field, _operator, nil), do: query

  defp maybe_datetime(query, field, :>=, value),
    do: where(query, [application], field(application, ^field) >= ^value)

  defp maybe_datetime(query, field, :<=, value),
    do: where(query, [application], field(application, ^field) <= ^value)

  defp maybe_after_application(query, nil), do: query

  defp maybe_after_application(query, {submitted_at, public_ref}) do
    where(
      query,
      [application],
      application.submitted_at > ^submitted_at or
        (application.submitted_at == ^submitted_at and application.public_ref > ^public_ref)
    )
  end

  defp maybe_after_event(query, nil), do: query

  defp maybe_after_event(query, {occurred_at, id}) do
    where(
      query,
      [event],
      event.occurred_at > ^occurred_at or (event.occurred_at == ^occurred_at and event.id > ^id)
    )
  end

  defp normalize_statuses(statuses) when is_list(statuses) do
    allowed = CommunityApplication.statuses()
    Enum.filter(statuses, &(&1 in allowed))
  end

  defp normalize_statuses(_), do: []

  defp decode_application_cursor(cursor) do
    with {:ok, decoded} <- decode_cursor(cursor),
         [datetime, public_ref] <- String.split(decoded, "|", parts: 2),
         {:ok, submitted_at, _offset} <- DateTime.from_iso8601(datetime) do
      {submitted_at, public_ref}
    else
      _ -> nil
    end
  end

  defp decode_event_cursor(cursor) do
    with {:ok, decoded} <- decode_cursor(cursor),
         [datetime, id] <- String.split(decoded, "|", parts: 2),
         {:ok, occurred_at, _offset} <- DateTime.from_iso8601(datetime),
         {id, ""} <- Integer.parse(id) do
      {occurred_at, id}
    else
      _ -> nil
    end
  end

  defp decode_cursor(cursor) when is_binary(cursor),
    do: Base.url_decode64(cursor, padding: false)

  defp decode_cursor(_), do: :error

  defp fetch(schema, id) do
    case Repo.get(schema, id) do
      nil -> {:error, :application_not_found}
      record -> {:ok, record}
    end
  end

  defp get(map, key, default \\ nil),
    do: Map.get(map, key, Map.get(map, Atom.to_string(key), default))
end
