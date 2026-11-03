defmodule GroupherServer.CMS.ArtimentMentions.Model.SyncState do
  @moduledoc """
  Tracks desired and committed Mention tokens for one stable content source.

      publication intent -> SyncState -> committed fact replacement
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @source_types [:post, :blog, :changelog, :ticket, :doc, :comment]

  schema "artiment_mention_sync_states" do
    field(:source_type, Ecto.Enum, values: @source_types)
    field(:source_article_id, Ecto.UUID)
    field(:source_comment_id, :id)
    field(:source_branch_id, :id)
    field(:desired_content_token, :string)
    field(:synced_content_token, :string)
    field(:synced_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(state, attrs) do
    state
    |> cast(attrs, [
      :source_type,
      :source_article_id,
      :source_comment_id,
      :source_branch_id,
      :desired_content_token,
      :synced_content_token,
      :synced_at
    ])
    |> validate_required([:source_type, :desired_content_token])
    |> check_constraint(:source_article_id, name: :mention_sync_source_identity_check)
    |> check_constraint(:source_branch_id, name: :mention_sync_source_branch_check)
    |> unique_constraint([:source_type, :source_article_id],
      name: :mention_sync_article_source_unique
    )
    |> unique_constraint([:source_type, :source_article_id, :source_branch_id],
      name: :mention_sync_doc_source_unique
    )
    |> unique_constraint(:source_comment_id, name: :mention_sync_comment_source_unique)
  end
end
