defmodule GroupherServer.Repo.Migrations.CreateViewTracker do
  use Ecto.Migration

  @reaction_tables ~w(
    post_reaction_infos
    blog_reaction_infos
    changelog_reaction_infos
    doc_reaction_infos
    comment_reaction_infos
  )a

  def up do
    drop(table(:view_events, prefix: "cms"))

    Enum.each(@reaction_tables, fn table_name ->
      alter table(table_name, prefix: "cms") do
        remove(:viewed_user_ids)
      end
    end)

    create table(:view_events, primary_key: false, prefix: "cms") do
      add(:event_id, :uuid, primary_key: true)
      add(:target_type, :string, null: false)
      add(:target_id, :bigint, null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :nilify_all))
      add(:viewer_tracking_key, :binary)
      add(:actor_type, :string, null: false)
      add(:is_authenticated, :boolean, null: false, default: false)
      add(:actor_confidence, :string, null: false)
      add(:classified_by, :string, null: false)
      add(:occurred_at, :timestamptz, null: false)
      add(:policy_version, :integer, null: false, default: 1)
      add(:counted, :boolean, null: false, default: true)
      add(:decision_reason, :string, null: false)
      add(:read_purpose, :string, null: false)
      add(:projected_at, :timestamptz)
      add(:failed_at, :timestamptz)
      add(:failure_reason, :string)
      add(:retry_count, :integer, null: false, default: 0)

      timestamps()
    end

    create(index(:view_events, [:target_type, :target_id, :occurred_at], prefix: "cms"))

    create(
      index(:view_events, [:user_id, :target_type, :target_id],
        prefix: "cms",
        name: :view_events_pending_viewer_lookup_index,
        where: "projected_at IS NULL AND counted = true AND user_id IS NOT NULL"
      )
    )

    create(
      index(:view_events, [:target_type, :target_id, :occurred_at],
        prefix: "cms",
        name: :view_events_pending_projection_index,
        where: "projected_at IS NULL AND counted = true"
      )
    )

    create(index(:view_events, [:viewer_tracking_key, :occurred_at], prefix: "cms"))

    create table(:article_viewer_states, primary_key: false, prefix: "cms") do
      add(:target_type, :string, null: false)
      add(:target_id, :bigint, null: false)
      add(:user_id, references(:users, prefix: "account", on_delete: :delete_all), null: false)
      timestamps(updated_at: false)
    end

    create(
      unique_index(:article_viewer_states, [:target_type, :target_id, :user_id],
        prefix: "cms",
        name: :article_viewer_states_target_user_index
      )
    )

    create(
      index(:article_viewer_states, [:user_id, :target_type, :target_id],
        prefix: "cms",
        name: :article_viewer_states_user_target_index
      )
    )

    create table(:article_view_dedupe_states, primary_key: false, prefix: "cms") do
      add(:target_type, :string, null: false)
      add(:target_id, :bigint, null: false)
      add(:viewer_tracking_key, :binary, null: false)
      add(:last_counted_at, :timestamptz, null: false)

      timestamps(updated_at: false)
    end

    create(
      unique_index(
        :article_view_dedupe_states,
        [:target_type, :target_id, :viewer_tracking_key],
        prefix: "cms",
        name: :article_view_dedupe_states_target_viewer_index
      )
    )

    create(
      index(:article_view_dedupe_states, [:last_counted_at],
        prefix: "cms",
        name: :article_view_dedupe_states_last_counted_at_index
      )
    )
  end

  def down do
    drop(table(:article_view_dedupe_states, prefix: "cms"))
    drop(table(:article_viewer_states, prefix: "cms"))
    drop(table(:view_events, prefix: "cms"))

    Enum.each(@reaction_tables, fn table_name ->
      alter table(table_name, prefix: "cms") do
        add(:viewed_user_ids, :roaringbitmap64, null: false, default: "{}")
      end
    end)
  end
end
