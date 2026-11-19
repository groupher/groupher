defmodule GroupherServer.CMS.Model.CommunityAdminRequest do
  @moduledoc """
  A Community-scoped Admin invite or application with an immutable proposal.

      Admin request command -> request and decision -> Community authorization
  """
  use Ecto.Schema
  use Flop.Schema
  import Ecto.Changeset

  @flop_options [filterable: [], sortable: [:inserted_at, :id], pagination_types: [:page, :first]]

  alias GroupherServer.CMS
  alias CMS.Passport.Catalog
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}
  @fields ~w(community_id subject_user_id created_by_id type status decision proposed_permissions
             approved_permissions revision decided_by_id decided_at cancelled_by_id cancelled_at
             expires_at reason)a

  schema "community_admin_requests" do
    field(:community_id, :integer)
    field(:subject_user_id, :integer)
    field(:created_by_id, :integer)
    field(:type, Ecto.Enum, values: [:invite, :apply])

    field(:status, Ecto.Enum,
      values: [:pending, :decided, :cancelled, :expired],
      default: :pending
    )

    field(:decision, Ecto.Enum, values: [:accept, :reject])
    field(:proposed_permissions, :map)
    field(:approved_permissions, :map)
    field(:revision, :integer, default: 1)
    field(:decided_by_id, :integer)
    field(:decided_at, :utc_datetime)
    field(:cancelled_by_id, :integer)
    field(:cancelled_at, :utc_datetime)
    field(:expires_at, :utc_datetime)
    field(:reason, :string)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates the request's scoped grant maps and persistent constraints."
  def changeset(request, attrs) do
    request
    |> cast(attrs, @fields)
    |> validate_required([
      :community_id,
      :subject_user_id,
      :created_by_id,
      :type,
      :status,
      :proposed_permissions,
      :revision,
      :expires_at
    ])
    |> validate_number(:revision, greater_than: 0)
    |> validate_permission_map(:proposed_permissions)
    |> validate_permission_map(:approved_permissions)
    |> unique_constraint([:community_id, :subject_user_id],
      name: :community_admin_requests_pending_index
    )
    |> check_constraint(:proposed_permissions, name: :community_admin_proposal_immutable)
    |> check_constraint(:status, name: :community_admin_requests_status_check)
    |> check_constraint(:status, name: :community_admin_requests_state_check)
    |> check_constraint(:revision, name: :community_admin_requests_revision_check)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:subject_user_id)
    |> foreign_key_constraint(:created_by_id)
    |> foreign_key_constraint(:decided_by_id)
    |> foreign_key_constraint(:cancelled_by_id)
  end

  defp validate_permission_map(changeset, field) do
    case get_field(changeset, field) do
      nil ->
        changeset

      permissions ->
        case Catalog.validate_permissions(:community, permissions) do
          {:ok, normalized} -> put_change(changeset, field, normalized)
          {:error, reason} -> add_error(changeset, field, to_string(reason))
        end
    end
  end
end
