defmodule GroupherServer.CMS.Model.CommunitySlugClaim do
  @moduledoc """
  Single namespace claim shared by applications and communities.

  Business position:

      CMS context
        -> CommunitySlugClaim schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityApplication}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @statuses ~w(application community reserved cooldown disputed)a
  @required_fields ~w(slug status claimed_by_user_id claim_reason)a
  @optional_fields ~w(application_id community_id expires_at released_at cooldown_until)a

  @type t :: %__MODULE__{}

  schema "community_slug_claims" do
    field(:slug, :string)
    field(:status, Ecto.Enum, values: @statuses)
    belongs_to(:application, CommunityApplication)
    belongs_to(:community, Community)
    belongs_to(:claimed_by_user, User)
    field(:claim_reason, :string)
    field(:expires_at, :utc_datetime)
    field(:released_at, :utc_datetime)
    field(:cooldown_until, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = claim, attrs) do
    claim
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:slug, min: 1, max: 30)
    |> Slug.validate_changeset(:slug)
    |> foreign_key_constraint(:application_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:claimed_by_user_id)
    |> unique_constraint(:slug, name: :community_slug_claims_active_slug_index)
  end
end
