defmodule GroupherServer.Messaging.Model.Notice do
  @moduledoc """
  Ecto schema for grouped activity notifications.

  Notices collect one or more actors around a target type so inbox UI can
  show compact activity rows instead of one row per repeated type.

  Business position:

      Messaging context
        -> Notice schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Flop.Schema

  @flop_options [
    filterable: [],
    sortable: [:id, :inserted_at],
    pagination_types: [:page, :first]
  ]

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.{Messaging, Accounts, CMS}
  alias Accounts.Model.User
  alias Messaging.NoticeContract

  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.messaging()
  @notice_types NoticeContract.activity_types() ++ NoticeContract.request_actions()

  @required_fields ~w(user_id type)a
  @optional_fields ~w(thread article_id comment_id title read from_users_count request_type request_id request_revision event_type)a

  @type t :: %Notice{}
  schema "notices" do
    belongs_to(:user, User)
    field(:thread, Ecto.Enum, values: GroupherServer.CMS.artiment_threads_enums())
    field(:article_id, Ecto.UUID)
    field(:title, :string)
    field(:comment_id, :id)
    field(:type, Ecto.Enum, values: @notice_types)
    field(:request_type, Ecto.Enum, values: [:article_co_author, :community_admin])
    field(:request_id, Ecto.UUID)
    field(:request_revision, :integer)
    field(:event_type, Ecto.Enum, values: [:created, :decided, :cancelled, :expired])
    embeds_many(:from_users, Embeds.User, on_replace: :delete)
    field(:from_users_count, :integer)

    field(:read, :boolean, default: false)

    timestamps(type: :utc_datetime)
  end

  @doc "Casts a grouped Notice and validates either activity-actor or request-event shape."
  def changeset(%Notice{} = mention, attrs) do
    mention
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:from_users, required: false, with: &Embeds.User.changeset/2)
    |> validate_request_shape()
    |> foreign_key_constraint(:user_id)
  end

  defp validate_request_shape(changeset) do
    request_fields = [:request_type, :request_id, :request_revision, :event_type]
    request_values = Enum.map(request_fields, &get_field(changeset, &1))

    case Enum.all?(request_values, &is_nil/1) do
      true ->
        changeset
        |> validate_activity_actors()
        |> validate_number(:from_users_count, greater_than: 0)

      false ->
        changeset
        |> validate_required(request_fields)
        |> validate_number(:request_revision, greater_than: 0)
        |> validate_request_type()
        |> validate_request_actors()
    end
  end

  defp validate_activity_actors(changeset) do
    case get_field(changeset, :from_users, []) do
      [] -> add_error(changeset, :from_users, "can't be blank", validation: :required)
      _actors -> changeset
    end
  end

  defp validate_request_type(changeset) do
    type = get_field(changeset, :type)
    event = get_field(changeset, :event_type)

    valid? =
      (event == :created and type in [:invite, :apply]) or
        (event in [:decided, :cancelled, :expired] and type == :result)

    if valid? do
      changeset
    else
      add_error(changeset, :type, "invalid request notice type/event")
    end
  end

  defp validate_request_actors(changeset) do
    actors = get_field(changeset, :from_users, [])
    actor_count = get_field(changeset, :from_users_count)
    system_expiry? = get_field(changeset, :event_type) == :expired

    case {system_expiry?, length(actors), actor_count} do
      {true, 0, 0} ->
        changeset

      {false, 1, 1} ->
        changeset

      {true, _, _} ->
        add_error(changeset, :from_users, "system expiry must not impersonate an actor")

      {false, _, _} ->
        add_error(changeset, :from_users, "request notice requires one actor")
    end
  end
end
