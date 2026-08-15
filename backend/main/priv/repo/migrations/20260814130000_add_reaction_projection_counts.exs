defmodule GroupherServer.Repo.Migrations.AddReactionProjectionCounts do
  use Ecto.Migration

  @article_targets [
    {:post_reaction_infos, :post_id},
    {:blog_reaction_infos, :blog_id},
    {:changelog_reaction_infos, :changelog_id},
    {:doc_reaction_infos, :doc_id}
  ]

  @comment_target {:comment_reaction_infos, :comment_id}

  def up do
    Enum.each(@article_targets, &add_article_counts/1)
    add_comment_counts(@comment_target)
    Enum.each([@comment_target | @article_targets], &add_emotion_counts/1)
  end

  def down do
    Enum.each([@comment_target | @article_targets], &drop_emotion_counts/1)
    drop_comment_counts(@comment_target)
    Enum.each(@article_targets, &drop_article_counts/1)
  end

  defp add_article_counts({table, target_id}) do
    alter table(table, prefix: "cms") do
      add(:upvotes_count, :integer, null: false, default: 0)
      add(:collects_count, :integer, null: false, default: 0)
    end

    create(index(table, [:upvotes_count, target_id], prefix: "cms"))
    create(index(table, [:collects_count, target_id], prefix: "cms"))
  end

  defp add_comment_counts({table, target_id}) do
    alter table(table, prefix: "cms") do
      add(:upvotes_count, :integer, null: false, default: 0)
    end

    create(index(table, [:upvotes_count, target_id], prefix: "cms"))
  end

  defp add_emotion_counts({reaction_table, _target_id}) do
    table = emotion_table(reaction_table)

    alter table(table, prefix: "cms") do
      add(:users_count, :integer, null: false, default: 0)
    end
  end

  defp drop_article_counts({table, target_id}) do
    drop(index(table, [:upvotes_count, target_id], prefix: "cms"))
    drop(index(table, [:collects_count, target_id], prefix: "cms"))

    alter table(table, prefix: "cms") do
      remove(:upvotes_count)
      remove(:collects_count)
    end
  end

  defp drop_comment_counts({table, target_id}) do
    drop(index(table, [:upvotes_count, target_id], prefix: "cms"))

    alter table(table, prefix: "cms") do
      remove(:upvotes_count)
    end
  end

  defp drop_emotion_counts({reaction_table, _target_id}) do
    alter table(emotion_table(reaction_table), prefix: "cms") do
      remove(:users_count)
    end
  end

  defp emotion_table(reaction_table) do
    reaction_table
    |> Atom.to_string()
    |> String.replace_suffix("reaction_infos", "emotion_infos")
    |> String.to_atom()
  end
end
