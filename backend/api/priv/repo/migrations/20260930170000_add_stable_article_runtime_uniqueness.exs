defmodule GroupherServer.Repo.Migrations.AddStableArticleRuntimeUniqueness do
  use Ecto.Migration

  @moduledoc "Adds ordinary-Article uniqueness required by stable runtime upserts."

  @prefix "cms"
  @projection_tables [
    :post_reaction_infos,
    :blog_reaction_infos,
    :changelog_reaction_infos,
    :doc_reaction_infos
  ]
  @emotion_tables [
    :post_emotion_infos,
    :blog_emotion_infos,
    :changelog_emotion_infos,
    :doc_emotion_infos
  ]

  def up do
    create(
      unique_index(:article_upvotes, [:user_id, :article_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL AND branch_id IS NULL",
        name: :article_upvotes_user_article_index
      )
    )

    create(
      unique_index(:article_collects, [:user_id, :article_id],
        prefix: @prefix,
        where: "article_id IS NOT NULL AND branch_id IS NULL",
        name: :article_collects_user_article_index
      )
    )

    create(
      unique_index(:articles_users_emotions, [:user_id, :article_id, :emotion],
        prefix: @prefix,
        where: "article_id IS NOT NULL AND branch_id IS NULL",
        name: :articles_users_emotions_user_article_emotion_index
      )
    )

    Enum.each(@projection_tables, fn table ->
      create(
        unique_index(table, [:article_id],
          prefix: @prefix,
          where: "article_id IS NOT NULL AND branch_id IS NULL",
          name: String.to_atom("#{table}_stable_article_index")
        )
      )
    end)

    Enum.each(@emotion_tables, fn table ->
      create(
        unique_index(table, [:article_id, :emotion],
          prefix: @prefix,
          where: "article_id IS NOT NULL AND branch_id IS NULL",
          name: String.to_atom("#{table}_stable_article_emotion_index")
        )
      )
    end)
  end

  def down do
    Enum.each(Enum.reverse(@emotion_tables), fn table ->
      drop_if_exists(
        index(table, [:article_id, :emotion],
          prefix: @prefix,
          name: String.to_atom("#{table}_stable_article_emotion_index")
        )
      )
    end)

    Enum.each(Enum.reverse(@projection_tables), fn table ->
      drop_if_exists(
        index(table, [:article_id],
          prefix: @prefix,
          name: String.to_atom("#{table}_stable_article_index")
        )
      )
    end)

    drop_if_exists(
      index(:articles_users_emotions, [:user_id, :article_id, :emotion],
        prefix: @prefix,
        name: :articles_users_emotions_user_article_emotion_index
      )
    )

    drop_if_exists(
      index(:article_collects, [:user_id, :article_id],
        prefix: @prefix,
        name: :article_collects_user_article_index
      )
    )

    drop_if_exists(
      index(:article_upvotes, [:user_id, :article_id],
        prefix: @prefix,
        name: :article_upvotes_user_article_index
      )
    )
  end
end
