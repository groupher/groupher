defmodule GroupherServer.Repo.Migrations.AddStableArticleRuntimeIdentity do
  use Ecto.Migration

  @moduledoc """
  Adds the stable Article UUID to the first runtime relation group.

  Legacy polymorphic columns remain nullable only during the repository-wide
  cutover; the follow-up destructive migration removes them after all readers
  and writers use `article_id`.
  """

  @prefix "cms"
  @tables [
    :comments,
    :article_upvotes,
    :article_collects,
    :articles_users_emotions,
    :abuse_reports
  ]
  @projection_tables [
    :post_reaction_infos,
    :blog_reaction_infos,
    :changelog_reaction_infos,
    :doc_reaction_infos,
    :post_emotion_infos,
    :blog_emotion_infos,
    :changelog_emotion_infos,
    :doc_emotion_infos
  ]

  def up do
    Enum.each(@tables, fn table ->
      alter table(table, prefix: @prefix) do
        add(
          :article_id,
          references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all)
        )

        add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all))
      end

      create(index(table, [:article_id, :branch_id], prefix: @prefix))
    end)

    create(
      unique_index(:article_upvotes, [:user_id, :article_id, :branch_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :article_upvotes_user_stable_article_index
      )
    )

    create(
      unique_index(:article_collects, [:user_id, :article_id, :branch_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :article_collects_user_stable_article_index
      )
    )

    create(
      unique_index(:articles_users_emotions, [:user_id, :article_id, :branch_id, :emotion],
        prefix: @prefix,
        where: "article_id IS NOT NULL",
        name: :articles_users_emotions_user_stable_article_emotion_index
      )
    )

    for {table, constraint} <- [
          {:comments, :comments_exactly_one_article_ref_check},
          {:comments, :comments_thread_matches_article_ref_check},
          {:article_upvotes, :article_upvotes_exactly_one_article_ref_check},
          {:article_upvotes, :article_upvotes_thread_matches_article_ref_check},
          {:article_collects, :article_collects_exactly_one_article_ref_check},
          {:article_collects, :article_collects_thread_matches_article_ref_check},
          {:articles_users_emotions, :articles_users_emotions_exactly_one_article_ref_check},
          {:abuse_reports, :abuse_reports_at_most_one_article_ref_check}
        ] do
      execute("ALTER TABLE cms.#{table} DROP CONSTRAINT IF EXISTS #{constraint}")
    end

    Enum.each(@projection_tables, fn table ->
      alter table(table, prefix: @prefix) do
        add(
          :article_id,
          references(:articles, type: :uuid, prefix: @prefix, on_delete: :delete_all)
        )

        add(:branch_id, references(:doc_branches, prefix: @prefix, on_delete: :delete_all))
      end

      create(index(table, [:article_id, :branch_id], prefix: @prefix))
    end)
  end

  def down do
    Enum.each(Enum.reverse(@projection_tables), fn table ->
      drop_if_exists(index(table, [:article_id, :branch_id], prefix: @prefix))

      alter table(table, prefix: @prefix) do
        remove(:branch_id)
        remove(:article_id)
      end
    end)

    drop_if_exists(
      index(:articles_users_emotions, [:user_id, :article_id, :branch_id, :emotion],
        prefix: @prefix,
        name: :articles_users_emotions_user_stable_article_emotion_index
      )
    )

    drop_if_exists(
      index(:article_collects, [:user_id, :article_id, :branch_id],
        prefix: @prefix,
        name: :article_collects_user_stable_article_index
      )
    )

    drop_if_exists(
      index(:article_upvotes, [:user_id, :article_id, :branch_id],
        prefix: @prefix,
        name: :article_upvotes_user_stable_article_index
      )
    )

    Enum.each(Enum.reverse(@tables), fn table ->
      drop_if_exists(index(table, [:article_id, :branch_id], prefix: @prefix))

      alter table(table, prefix: @prefix) do
        remove(:branch_id)
        remove(:article_id)
      end
    end)
  end
end
