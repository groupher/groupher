defmodule GroupherServer.Repo.Migrations.SharedCommentSummaryFields do
  @moduledoc """
  Creates persisted shared Comment summaries on a fresh Article dataset.

      stable Article / root Comment -> atomic counters + bounded user snapshots

  This migration and the matching writer/reader cutover are one release unit.
  """
  use Ecto.Migration

  @prefix "cms"

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles) OR EXISTS (SELECT 1 FROM cms.comments) THEN
        RAISE EXCEPTION 'Shared Comment summaries require a fresh Article dataset';
      END IF;
    END $$;
    """)

    alter table(:article_stats, prefix: @prefix) do
      add(:comments_participants, :map, null: false, default: fragment("'[]'::jsonb"))
      modify(:comments_revision, :bigint, null: false, default: 1)
    end

    alter table(:comments, prefix: @prefix) do
      add(:reply_entries_count, :integer, null: false, default: 0)
      add(:reply_participants, :map, null: false, default: fragment("'[]'::jsonb"))
      add(:last_reply_at, :timestamptz)
      add(:replies_revision, :bigint, null: false, default: 1)
      modify(:replies_count, :integer, null: false, default: 0)
    end

    create(
      index(:comments, [:article_id, :author_id, :inserted_at, :id],
        prefix: @prefix,
        name: :comments_article_participation_index
      )
    )

    create(
      index(:comments, [:root_comment_id, :inserted_at, :id],
        prefix: @prefix,
        name: :comments_root_participation_index
      )
    )

    create(
      constraint(:article_stats, :article_stats_comment_summary_check,
        prefix: @prefix,
        check:
          "comments_count >= 0 AND comments_participants_count >= 0 AND comments_revision >= 1 AND jsonb_typeof(comments_participants) = 'array' AND jsonb_array_length(comments_participants) <= 10"
      )
    )

    create(
      constraint(:comments, :comments_reply_summary_check,
        prefix: @prefix,
        check:
          "replies_count >= 0 AND reply_entries_count >= replies_count AND replies_revision >= 1 AND jsonb_typeof(reply_participants) = 'array' AND jsonb_array_length(reply_participants) <= 4"
      )
    )
  end

  def down do
    raise "Restore the matching application/schema environment; no legacy summary fallback"
  end
end
