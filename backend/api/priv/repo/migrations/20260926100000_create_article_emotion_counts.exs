defmodule GroupherServer.Repo.Migrations.CreateArticleEmotionCounts do
  use Ecto.Migration

  @emotion_types ~w(downvote beer heart biceps orz confused pill popcorn)

  def up do
    create table(:article_emotion_counts, primary_key: false, prefix: "cms") do
      add(:thread, :string, primary_key: true, null: false)
      add(:article_id, :bigint, primary_key: true, null: false)
      add(:type, :string, primary_key: true, null: false)
      add(:count, :bigint, null: false, default: 0)
      add(:interaction_revision, :bigint, null: false, default: 0)

      timestamps()
    end

    create(
      constraint(:article_emotion_counts, :article_emotion_counts_thread_check,
        prefix: "cms",
        check: "thread IN ('post', 'blog', 'changelog', 'doc')"
      )
    )

    create(
      constraint(:article_emotion_counts, :article_emotion_counts_type_check,
        prefix: "cms",
        check: "type IN (#{quoted_values(@emotion_types)})"
      )
    )

    create(
      constraint(:article_emotion_counts, :article_emotion_counts_non_negative_check,
        prefix: "cms",
        check: "count >= 0 AND interaction_revision >= 0"
      )
    )

    create(
      index(:article_emotion_counts, [:thread, :type, desc: :count, desc: :article_id],
        prefix: "cms",
        name: :article_emotion_counts_order_idx
      )
    )

    alter table(:article_stats, prefix: "cms") do
      remove(:reaction_counts)
    end
  end

  def down do
    raise "CreateArticleEmotionCounts is an irreversible protocol cutover"
  end

  defp quoted_values(values) do
    values
    |> Enum.map_join(", ", &"'#{&1}'")
  end
end
