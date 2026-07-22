defmodule GroupherServer.CMS.ContentImport.Persistence.Job.Body do
  @moduledoc """
  Authoritative PostgreSQL staging row for one canonical BodyBag.

  See `docs/bulk-import/article-publish-import-refactor.md` for staging and apply ownership.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(job_id job_item_id external_ref body_bag body_hash body_size_bytes)a

  @type t :: %__MODULE__{}

  schema "content_import_job_bodies" do
    belongs_to(:job, Job)
    belongs_to(:job_item, Item)

    field(:external_ref, :string)
    field(:body_bag, :map)
    field(:body_hash, :string)
    field(:body_size_bytes, :integer)

    timestamps(type: :utc_datetime)
  end

  @doc "Builds the authoritative staged BodyBag row for one Job item."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = body, attrs) do
    body
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> validate_length(:external_ref, min: 1, max: 1_024)
    |> validate_format(:body_hash, ~r/\A[0-9a-f]{64}\z/)
    |> validate_number(:body_size_bytes, greater_than: 0)
    |> foreign_key_constraint(:job_id)
    |> foreign_key_constraint(:job_item_id)
    |> unique_constraint([:job_id, :external_ref],
      name: :content_import_job_bodies_job_source_index
    )
    |> unique_constraint(:job_item_id)
  end
end
