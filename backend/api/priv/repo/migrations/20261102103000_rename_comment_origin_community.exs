defmodule GroupherServer.Repo.Migrations.RenameCommentOriginCommunity do
  @moduledoc "Names the Comment creation Community as an optional origin."

  use Ecto.Migration

  def up do
    execute("ALTER TABLE cms.comments RENAME COLUMN community_id TO origin_community_id")
  end

  def down do
    execute("ALTER TABLE cms.comments RENAME COLUMN origin_community_id TO community_id")
  end
end
