defmodule GroupherServer.Messaging.Model.Notification do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.messaging()

  @required_fields ~w(user_id action)a
  @optional_fields ~w(thread article_id comment_id title read)a

  @type t :: %Notification{}
  schema "notifications" do
    belongs_to(:user, User)
    field(:thread, :string)
    field(:article_id, :id)
    field(:title, :string)
    field(:comment_id, :id)
    field(:action, :string)
    embeds_many(:from_users, Embeds.User, on_replace: :delete)
    field(:from_users_count, :integer)

    field(:read, :boolean, default: false)

    timestamps(type: :utc_datetime)
  end

  def changeset(%Notification{} = mention, attrs) do
    mention
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:from_users, required: true, with: &Embeds.User.changeset/2)
    |> foreign_key_constraint(:user_id)
  end
end
