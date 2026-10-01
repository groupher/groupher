defmodule GroupherServer.CMS.Helper.Constraints do
  @moduledoc """
  Ecto constraint helpers for CMS models.
  This module has no dependencies on other CMS modules to avoid circular dependencies.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Constraints
        -> Repo / external boundary
  """

  import Ecto.Changeset
  @spec comment_emotion_unique_key_constraint(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def comment_emotion_unique_key_constraint(%Ecto.Changeset{} = changeset) do
    unique_constraint(changeset, :emotion,
      name: :comments_users_emotions_comment_id_user_id_emotion_index
    )
  end
end
