defmodule GroupherServer.Repo.Migrations.NarrowUserEmotionsTables do
  use Ecto.Migration

  @article_threads [:post, :blog, :changelog, :doc]

  def up do
    drop_if_exists(table(:comments_users_emotions, prefix: "cms"))
    drop_if_exists(table(:articles_users_emotions, prefix: "cms"))

    create table(:comments_users_emotions, prefix: "cms") do
      add(:comment_id, references(:comments, prefix: "cms", on_delete: :delete_all), null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :delete_all), null: false)

      add(:recived_user_id, references(:users, prefix: "account", on_delete: :delete_all),
        null: false
      )
      add(:emotion, :string, null: false)

      timestamps()
    end

    create(unique_index(:comments_users_emotions, [:comment_id, :user_id, :emotion],
             prefix: "cms",
             name: :comments_users_emotions_comment_id_user_id_emotion_index
           ))

    create(index(:comments_users_emotions, [:comment_id, :emotion, :updated_at],
             prefix: "cms",
             name: :comments_users_emotions_comment_id_emotion_updated_at_index
           ))

    create(index(:comments_users_emotions, [:user_id], prefix: "cms"))
    create(index(:comments_users_emotions, [:recived_user_id], prefix: "cms"))

    create table(:articles_users_emotions, prefix: "cms") do
      add(:user_id, references(:users, prefix: "account", on_delete: :delete_all), null: false)

      add(:recived_user_id, references(:users, prefix: "account", on_delete: :delete_all),
        null: false
      )
      add(:emotion, :string, null: false)

      add(:post_id, references(:posts, prefix: "cms", on_delete: :delete_all))
      add(:blog_id, references(:blogs, prefix: "cms", on_delete: :delete_all))
      add(:changelog_id, references(:changelogs, prefix: "cms", on_delete: :delete_all))
      add(:doc_id, references(:docs, prefix: "cms", on_delete: :delete_all))

      timestamps()
    end

    execute("""
    ALTER TABLE cms.articles_users_emotions
    ADD CONSTRAINT articles_users_emotions_exactly_one_article_ref_check
    CHECK (
      ((post_id IS NOT NULL)::int +
       (blog_id IS NOT NULL)::int +
       (changelog_id IS NOT NULL)::int +
       (doc_id IS NOT NULL)::int) = 1
    )
    """)

    Enum.each(@article_threads, fn thread ->
      execute("""
      CREATE UNIQUE INDEX article_user_emotions_user_id_#{thread}_id_emotion_index
      ON cms.articles_users_emotions (user_id, #{thread}_id, emotion)
      WHERE #{thread}_id IS NOT NULL
      """)

      execute("""
      CREATE INDEX article_user_emotions_#{thread}_id_emotion_updated_at_index
      ON cms.articles_users_emotions (#{thread}_id, emotion, updated_at)
      WHERE #{thread}_id IS NOT NULL
      """)
    end)

    create(index(:articles_users_emotions, [:user_id], prefix: "cms"))
    create(index(:articles_users_emotions, [:recived_user_id], prefix: "cms"))
  end

  def down do
    raise Ecto.MigrationError,
      message:
        "NarrowUserEmotionsTables is irreversible; restore the previous schema from backup if needed."
  end
end
