defmodule GroupherServer.CMS.Model.PublishRequest do
  @moduledoc """
  Review gate for future publish workflows.

  Draft/public storage stays in the version tables. This table only tracks the
  product workflow that may sit between them later:

      docs(stage=draft) or doc_tree_nodes(stage=draft)
                    |
                    v
             publish_requests(status=pending)
                    |
          approve / reject / cancel
                    |
                    v
              publish service runs

  `target_type + target_id` deliberately stays generic so article threads and
  Tree snapshots can share one review queue without mixing their storage models.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(target_type target_id status)a
  @optional_fields ~w(base_snapshot_id requested_by_id reviewed_by_id requested_at reviewed_at note)a

  @type t :: %PublishRequest{}

  schema "publish_requests" do
    belongs_to(:requested_by, User)
    belongs_to(:reviewed_by, User)

    field(:target_type, :string)
    field(:target_id, :string)

    field(:status, Ecto.Enum,
      values: CMS.Const.publish_request_status_values(),
      default: CMS.Const.publish_request_status(:pending)
    )

    field(:base_snapshot_id, :id)
    field(:requested_at, :utc_datetime)
    field(:reviewed_at, :utc_datetime)
    field(:note, :string)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Builds a publish request changeset.

  ## Examples

      iex> PublishRequest.changeset(%PublishRequest{}, %{target_type: "doc_tree", target_id: "42"})
      %Ecto.Changeset{}
  """
  def changeset(%PublishRequest{} = request, attrs) do
    request
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:target_type, CMS.Const.publish_request_target_type_enum_values())
    |> validate_inclusion(:status, CMS.Const.publish_request_status_enum_values())
    |> validate_length(:target_id, min: 1, max: 120)
    |> foreign_key_constraint(:requested_by_id)
    |> foreign_key_constraint(:reviewed_by_id)
  end

  @doc """
  Builds an update changeset for review state transitions.

  ## Examples

      iex> PublishRequest.update_changeset(request, %{status: :approved})
      %Ecto.Changeset{}
  """
  def update_changeset(%PublishRequest{} = request, attrs), do: changeset(request, attrs)
end
