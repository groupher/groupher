defmodule GroupherServer.CMS.Model.Mentions.Endpoint do
  @moduledoc """
  Keeps a Mention resource identity after the live resource disappears.

      canonical Article or Comment -> stable endpoint -> current relationships
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @types [:post, :blog, :changelog, :doc, :ticket, :comment]

  schema "mention_endpoints" do
    field(:type, Ecto.Enum, values: @types)
    field(:article_id, Ecto.UUID)
    field(:comment_id, :id)
    field(:parent_endpoint_id, Ecto.UUID)
    field(:deleted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(endpoint, attrs) do
    endpoint
    |> cast(attrs, [:type, :article_id, :comment_id, :parent_endpoint_id, :deleted_at])
    |> validate_required([:type])
    |> check_constraint(:type, name: :mention_endpoint_identity_check)
    |> unique_constraint([:type, :article_id], name: :mention_endpoint_article_identity_index)
    |> unique_constraint(:comment_id, name: :mention_endpoint_comment_identity_index)
    |> foreign_key_constraint(:parent_endpoint_id)
  end
end
