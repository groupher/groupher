defmodule GroupherServer.Repo.Migrations.CutoverCommentStableIdentity do
  use Ecto.Migration

  @moduledoc "Removes physical-Article hash enforcement from stable Article comments."

  def up do
    execute("DROP TRIGGER IF EXISTS comments_article_hash_matches_article ON cms.comments")
    execute("DROP FUNCTION IF EXISTS cms.ensure_comment_article_hash_matches_article()")

    alter table(:comments, prefix: "cms") do
      modify(:article_hash_id, :uuid, null: true)
    end
  end

  def down do
    execute("SELECT 1")
  end
end
