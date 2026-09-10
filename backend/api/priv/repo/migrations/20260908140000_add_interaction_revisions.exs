defmodule GroupherServer.Repo.Migrations.AddInteractionRevisions do
  use Ecto.Migration

  @article_targets ~w(posts blogs changelogs docs)a
  @article_reaction_targets ~w(post blog changelog doc)a

  def change do
    Enum.each(@article_reaction_targets, fn target ->
      table_name = String.to_atom("#{target}_reaction_infos")

      alter table(table_name, prefix: "cms") do
        add(:interaction_revision, :bigint, null: false, default: 0)
      end
    end)

    alter table(:comment_reaction_infos, prefix: "cms") do
      add(:interaction_revision, :bigint, null: false, default: 0)
    end

    Enum.each(@article_targets, fn table ->
      alter table(table, prefix: "cms") do
        add(:comments_revision, :bigint, null: false, default: 0)
      end
    end)
  end
end
