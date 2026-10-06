defmodule GroupherServer.Repo.Migrations.DropRuntimePhysicalArticleRefs do
  use Ecto.Migration

  @moduledoc """
  Removes physical thread-table keys from interaction and moderation runtime data.

  Typed reaction and emotion rows are rebuildable projections and are cleared;
  authoritative user relations must already carry a stable Article UUID.
  """

  @authorities ~w(article_upvotes article_collects articles_users_emotions abuse_reports pinned_articles)
  @projections ~w(
    post_reaction_infos blog_reaction_infos changelog_reaction_infos doc_reaction_infos
    post_emotion_infos blog_emotion_infos changelog_emotion_infos doc_emotion_infos
  )
  @legacy_columns ~w(post_id blog_id changelog_id doc_id)

  def up do
    Enum.each(@projections, &execute("TRUNCATE TABLE cms.#{&1}"))

    Enum.each(@authorities ++ @projections, fn table ->
      Enum.each(@legacy_columns, fn column ->
        execute("ALTER TABLE cms.#{table} DROP COLUMN IF EXISTS #{column} CASCADE")
      end)
    end)

    Enum.each(~w(article_upvotes article_collects articles_users_emotions), fn table ->
      execute("ALTER TABLE cms.#{table} ALTER COLUMN article_id SET NOT NULL")
    end)

    Enum.each(@projections, fn table ->
      execute("ALTER TABLE cms.#{table} ALTER COLUMN article_id SET NOT NULL")
    end)

    create_projection_uniques()
  end

  def down, do: execute("SELECT 1")

  defp create_projection_uniques do
    Enum.each(~w(post_reaction_infos blog_reaction_infos changelog_reaction_infos doc_reaction_infos), fn table ->
      execute("CREATE UNIQUE INDEX #{table}_stable_doc_index ON cms.#{table} (article_id, branch_id) WHERE branch_id IS NOT NULL")
    end)

    Enum.each(~w(post_emotion_infos blog_emotion_infos changelog_emotion_infos doc_emotion_infos), fn table ->
      execute("CREATE UNIQUE INDEX #{table}_stable_doc_emotion_index ON cms.#{table} (article_id, branch_id, emotion) WHERE branch_id IS NOT NULL")
    end)
  end
end
