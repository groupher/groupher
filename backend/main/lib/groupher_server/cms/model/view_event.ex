defmodule GroupherServer.CMS.Model.ViewEvent do
  @moduledoc """
  Durable, idempotent view-event schema for article view projection.

  Business position:

      CMS.Interactions.View -> ViewEvent -> cms.view_events
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "view_events" do
    field(:event_id, Ecto.UUID, primary_key: true, autogenerate: false)
    field(:target_type, Ecto.Enum, values: Threads.article_enums())
    # The migration stores target_id as bigint; :id is Ecto's bigint type.
    field(:target_id, :id)
    belongs_to(:user, User, foreign_key: :user_id)
    field(:processed_at, :utc_datetime)
    field(:failed_at, :utc_datetime)
    field(:failure_reason, :string)
    field(:retry_count, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%__MODULE__{} = event, attrs) do
    event
    |> cast(attrs, [:event_id, :target_type, :target_id, :user_id])
    |> validate_required([:event_id, :target_type, :target_id])
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:event_id, name: :view_events_pkey)
  end
end
