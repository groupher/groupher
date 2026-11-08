defmodule GroupherServer.CMS.Model.Mentions.Edge do
  @moduledoc """
  Holds the current, queryable Mention relationships for a source.

      published source -> current edges -> graph queries
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @target_types [:post, :blog, :changelog, :doc, :ticket, :comment, :user, :url]

  schema "mention_current_edges" do
    field(:source_endpoint_id, Ecto.UUID)
    field(:target_type, Ecto.Enum, values: @target_types)
    field(:target_endpoint_id, Ecto.UUID)
    field(:target_user_id, :id)
    field(:normalized_url, :string)
    field(:url_hash, :string)
    field(:mention_case, Ecto.Enum, values: [:inline_mention, :link])
    field(:edge_key, :string)
    field(:mentioned_at, :utc_datetime)
    field(:occurrences_count, :integer)
    timestamps(type: :utc_datetime)
  end

  def changeset(edge, attrs) do
    edge
    |> cast(attrs, [
      :source_endpoint_id,
      :target_type,
      :target_endpoint_id,
      :target_user_id,
      :normalized_url,
      :url_hash,
      :mention_case,
      :edge_key,
      :mentioned_at,
      :occurrences_count
    ])
    |> validate_required([
      :source_endpoint_id,
      :target_type,
      :mention_case,
      :edge_key,
      :mentioned_at,
      :occurrences_count
    ])
    |> validate_number(:occurrences_count, greater_than: 0)
    |> check_constraint(:target_type, name: :mention_current_edge_target_check)
    |> check_constraint(:mention_case, name: :mention_current_edge_case_check)
    |> check_constraint(:normalized_url, name: :mention_current_edge_url_size_check)
    |> unique_constraint(:edge_key, name: :mention_current_edge_key_index)
    |> foreign_key_constraint(:source_endpoint_id)
    |> foreign_key_constraint(:target_endpoint_id, name: :mention_current_edge_target_identity_fk)
  end
end
