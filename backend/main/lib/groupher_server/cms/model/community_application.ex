defmodule GroupherServer.CMS.Model.CommunityApplication do
  @moduledoc """
  Persisted application aggregate for creating one community.

  The current row is the state authority. Events are append-only history and
  communities are not created until a reviewer approves this aggregate.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User

  alias GroupherServer.CMS.Model.{
    Community,
    CommunityApplicationEvent,
    CommunityApplicationLogoUpload
  }

  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @statuses ~w(
    submitted reviewing approved creation_failed setting_up setup_failed
    created rejected cancelled expired
  )a
  @blocking_statuses ~w(submitted reviewing approved setting_up)a
  @failed_statuses ~w(creation_failed setup_failed)a
  @categories ~w(PRODUCT GAMING TEACH GROUP)a

  @required_fields ~w(
    public_ref user_id status version title slug desc logo_asset_ref locale
    apply_category idempotency_key input_fingerprint submitted_at
  )a
  @optional_fields ~w(
    community_id apply_message policy_snapshot review_metadata expires_at reviewed_at
    setup_started_at completed_at cancelled_at expired_at last_job_error reviewer_id
    decision_reason_code decision_note
  )a

  @type status ::
          :submitted
          | :reviewing
          | :approved
          | :creation_failed
          | :setting_up
          | :setup_failed
          | :created
          | :rejected
          | :cancelled
          | :expired
  @type t :: %__MODULE__{}

  schema "community_applications" do
    field(:public_ref, :string)
    belongs_to(:user, User)
    belongs_to(:community, Community)
    belongs_to(:reviewer, User)

    field(:status, Ecto.Enum, values: @statuses, default: :submitted)
    field(:version, :integer, default: 1)
    field(:title, :string)
    field(:slug, :string)
    field(:desc, :string)
    field(:logo_asset_ref, :string)
    field(:locale, :string, default: "en")
    field(:apply_category, Ecto.Enum, values: @categories)
    field(:apply_message, :string)

    field(:idempotency_key, :string)
    field(:input_fingerprint, :string)
    field(:policy_snapshot, :map, default: %{})
    field(:review_metadata, :map, default: %{})

    field(:submitted_at, :utc_datetime)
    field(:expires_at, :utc_datetime)
    field(:reviewed_at, :utc_datetime)
    field(:setup_started_at, :utc_datetime)
    field(:completed_at, :utc_datetime)
    field(:cancelled_at, :utc_datetime)
    field(:expired_at, :utc_datetime)
    field(:last_job_error, :map)
    field(:decision_reason_code, :string)
    field(:decision_note, :string)

    has_many(:events, CommunityApplicationEvent, foreign_key: :application_id)
    has_one(:logo_upload, CommunityApplicationLogoUpload, foreign_key: :application_id)

    timestamps(type: :utc_datetime)
  end

  @spec statuses() :: [status()]
  def statuses, do: @statuses

  @spec blocking_statuses() :: [status()]
  def blocking_statuses, do: @blocking_statuses

  @spec failed_statuses() :: [status()]
  def failed_statuses, do: @failed_statuses

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = application, attrs) do
    application
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:apply_category, @categories)
    |> validate_number(:version, greater_than: 0)
    |> validate_length(:public_ref, min: 8, max: 80)
    |> validate_length(:title, min: 1, max: 80)
    |> validate_length(:slug, min: 1, max: 30)
    |> validate_length(:desc, min: 1, max: 2_000)
    |> validate_length(:logo_asset_ref, min: 8, max: 80)
    |> validate_length(:locale, min: 2, max: 20)
    |> validate_length(:apply_message, max: 2_000)
    |> validate_length(:idempotency_key, min: 8, max: 128)
    |> validate_length(:input_fingerprint, min: 16, max: 128)
    |> Slug.validate_changeset(:slug)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:reviewer_id)
    |> unique_constraint(:public_ref)
    |> unique_constraint([:user_id, :idempotency_key],
      name: :community_applications_user_idempotency_index
    )
    |> unique_constraint(:user_id,
      name: :community_applications_one_blocking_per_user_index
    )
  end
end
