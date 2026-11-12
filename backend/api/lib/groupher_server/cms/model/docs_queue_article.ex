defmodule GroupherServer.CMS.Model.DocsQueueArticle do
  @moduledoc """
  One Doc's queued WorkingCopy and its last absorbed default Snapshot.

      Queue -> Article member -> independent WorkingCopy + source Snapshot
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "docs_queue_articles" do
    field(:queue_id, Ecto.UUID, primary_key: true)
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:working_copy_id, Ecto.UUID)
    field(:source_snapshot_id, Ecto.UUID)
    field(:enqueued_by_id, :integer)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds one member after the caller has locked and verified its owners."
  def changeset(member, attrs) do
    member
    |> cast(attrs, [
      :queue_id,
      :article_id,
      :working_copy_id,
      :source_snapshot_id,
      :enqueued_by_id
    ])
    |> validate_required([
      :queue_id,
      :article_id,
      :working_copy_id,
      :source_snapshot_id,
      :enqueued_by_id
    ])
    |> unique_constraint([:queue_id, :article_id], name: :docs_queue_articles_pkey)
    |> unique_constraint(:working_copy_id, name: :docs_queue_articles_working_copy_id_index)
    |> foreign_key_constraint(:queue_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:enqueued_by_id)
    |> foreign_key_constraint(:working_copy_id, name: :docs_queue_articles_work_owner_fkey)
    |> foreign_key_constraint(:source_snapshot_id, name: :docs_queue_articles_snapshot_owner_fkey)
  end
end
