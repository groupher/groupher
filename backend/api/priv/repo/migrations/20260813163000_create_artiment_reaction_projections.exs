defmodule GroupherServer.Repo.Migrations.CreateArtimentReactionProjections do
  use Ecto.Migration

  @article_targets [
    {:post_reaction_infos, :posts, :post_id},
    {:blog_reaction_infos, :blogs, :blog_id},
    {:changelog_reaction_infos, :changelogs, :changelog_id},
    {:doc_reaction_infos, :docs, :doc_id}
  ]

  @comment_target {:comment_reaction_infos, :comments, :comment_id}

  def up do
    execute("CREATE EXTENSION IF NOT EXISTS roaringbitmap")

    Enum.each(@article_targets, &create_article_reaction_info/1)
    create_comment_reaction_info(@comment_target)

    Enum.each(@article_targets, &create_emotion_info/1)
    create_emotion_info(@comment_target)

    create_view_events()
  end

  def down do
    drop(table(:view_events, prefix: "cms"))

    Enum.each([@comment_target | @article_targets], fn {reaction_table, _target_table, _target_id} ->
      emotion_table =
        reaction_table
        |> Atom.to_string()
        |> String.replace_suffix("reaction_infos", "emotion_infos")
        |> String.to_atom()

      drop(table(emotion_table, prefix: "cms"))
      drop(table(reaction_table, prefix: "cms"))
    end)
  end

  defp create_article_reaction_info({table, target_table, target_id}) do
    create table(table, prefix: "cms") do
      add(target_id, references(target_table, prefix: "cms", on_delete: :delete_all), null: false)
      add(:viewed_user_ids, :roaringbitmap64, null: false)
      add(:upvoted_user_ids, :roaringbitmap64, null: false)
      add(:collected_user_ids, :roaringbitmap64, null: false)
      add(:reported_user_ids, :roaringbitmap64, null: false)
      add(:latest_upvoted_users, {:array, :map}, null: false, default: [])
      add(:latest_collected_users, {:array, :map}, null: false, default: [])

      timestamps()
    end

    set_bitmap_defaults(table, [
      :viewed_user_ids,
      :upvoted_user_ids,
      :collected_user_ids,
      :reported_user_ids
    ])

    create(unique_index(table, [target_id], prefix: "cms"))
  end

  defp create_comment_reaction_info({table, target_table, target_id}) do
    create table(table, prefix: "cms") do
      add(target_id, references(target_table, prefix: "cms", on_delete: :delete_all), null: false)
      add(:viewed_user_ids, :roaringbitmap64, null: false)
      add(:upvoted_user_ids, :roaringbitmap64, null: false)
      add(:reported_user_ids, :roaringbitmap64, null: false)
      add(:latest_upvoted_users, {:array, :map}, null: false, default: [])

      timestamps()
    end

    set_bitmap_defaults(table, [:viewed_user_ids, :upvoted_user_ids, :reported_user_ids])
    create(unique_index(table, [target_id], prefix: "cms"))
  end

  defp create_emotion_info({reaction_table, target_table, target_id}) do
    table =
      reaction_table
      |> Atom.to_string()
      |> String.replace_suffix("reaction_infos", "emotion_infos")
      |> String.to_atom()

    create table(table, prefix: "cms") do
      add(target_id, references(target_table, prefix: "cms", on_delete: :delete_all), null: false)
      add(:emotion, :string, null: false)
      add(:user_ids, :roaringbitmap64, null: false)
      add(:latest_users, {:array, :map}, null: false, default: [])

      timestamps()
    end

    set_bitmap_defaults(table, [:user_ids])
    create(unique_index(table, [target_id, :emotion], prefix: "cms"))
  end

  defp set_bitmap_defaults(table, fields) do
    Enum.each(fields, fn field ->
      execute("ALTER TABLE cms.#{table} ALTER COLUMN #{field} SET DEFAULT '{}'::roaringbitmap64")
    end)
  end

  defp create_view_events do
    create table(:view_events, primary_key: false, prefix: "cms") do
      add(:event_id, :uuid, primary_key: true)
      add(:target_type, :string, null: false)
      add(:target_id, :bigint, null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:processed_at, :utc_datetime)
      add(:failed_at, :utc_datetime)
      add(:failure_reason, :string)
      add(:retry_count, :integer, null: false, default: 0)

      timestamps()
    end

    create(index(:view_events, [:target_type, :target_id, :inserted_at], prefix: "cms"))
    create(index(:view_events, [:processed_at, :inserted_at], prefix: "cms"))
  end
end
