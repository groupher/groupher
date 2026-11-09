defmodule GroupherServer.Repo.Migrations.RebuildArtimentMentions do
  @moduledoc "Replaces Community-bound Mention snapshots with stable typed facts."

  use Ecto.Migration

  @prefix "cms"

  def up do
    drop(table(:artiment_mentions, prefix: @prefix))

    create table(:artiment_mentions, prefix: @prefix) do
      add(:mentioner_type, :string, null: false)
      add(:mentioner_article_id, references(:articles, type: :uuid, on_delete: :delete_all))
      add(:mentioner_comment_id, references(:comments, on_delete: :delete_all))
      add(:mentioner_branch_id, references(:doc_branches, on_delete: :delete_all))

      add(:mentioned_scope, :string, null: false)
      add(:mentioned_type, :string, null: false)
      add(:mentioned_article_id, references(:articles, type: :uuid, on_delete: :delete_all))
      add(:mentioned_comment_id, references(:comments, on_delete: :delete_all))

      add(
        :mentioned_user_id,
        references(:users, prefix: "account", on_delete: :delete_all)
      )

      add(:mentioned_branch_id, references(:doc_branches, on_delete: :delete_all))
      add(:external_url, :text)
      add(:external_url_hash, :text)

      add(:mention_case, :string, null: false)
      add(:occurrences, :map, null: false)
      add(:edge_key, :text, null: false)
      add(:mentioned_at, :timestamptz, null: false)
      timestamps()
    end

    create(
      constraint(:artiment_mentions, :mention_source_identity_check,
        prefix: @prefix,
        check: "(mentioner_article_id IS NOT NULL) <> (mentioner_comment_id IS NOT NULL)"
      )
    )

    create(
      constraint(:artiment_mentions, :mention_source_type_branch_check,
        prefix: @prefix,
        check:
          "(mentioner_type IN ('post','blog','changelog','ticket') AND " <>
            "mentioner_article_id IS NOT NULL AND mentioner_branch_id IS NULL) OR " <>
            "(mentioner_type = 'doc' AND mentioner_article_id IS NOT NULL AND " <>
            "mentioner_branch_id IS NOT NULL) OR " <>
            "(mentioner_type = 'comment' AND mentioner_comment_id IS NOT NULL)"
      )
    )

    create(
      constraint(:artiment_mentions, :mention_target_identity_check,
        prefix: @prefix,
        check:
          "(mentioned_scope = 'external' AND mentioned_type = 'url' AND " <>
            "external_url IS NOT NULL AND external_url_hash IS NOT NULL AND " <>
            "mentioned_article_id IS NULL AND mentioned_comment_id IS NULL AND " <>
            "mentioned_user_id IS NULL AND mentioned_branch_id IS NULL) OR " <>
            "(mentioned_scope = 'internal' AND external_url IS NULL AND " <>
            "external_url_hash IS NULL AND " <>
            "((mentioned_type IN ('post','blog','changelog','doc','ticket') AND " <>
            "mentioned_article_id IS NOT NULL AND mentioned_comment_id IS NULL AND " <>
            "mentioned_user_id IS NULL) OR " <>
            "(mentioned_type = 'comment' AND mentioned_article_id IS NULL AND " <>
            "mentioned_comment_id IS NOT NULL AND mentioned_user_id IS NULL) OR " <>
            "(mentioned_type = 'user' AND mentioned_article_id IS NULL AND " <>
            "mentioned_comment_id IS NULL AND mentioned_user_id IS NOT NULL)))"
      )
    )

    create(
      constraint(:artiment_mentions, :mention_occurrences_check,
        prefix: @prefix,
        check: "jsonb_typeof(occurrences) = 'array' AND jsonb_array_length(occurrences) > 0"
      )
    )

    create(unique_index(:artiment_mentions, [:edge_key], prefix: @prefix))

    create(
      index(
        :artiment_mentions,
        [:mentioner_type, :mentioner_article_id, :mentioner_branch_id, :id],
        prefix: @prefix,
        where: "mentioner_article_id IS NOT NULL",
        name: :mentions_article_outgoing_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioner_comment_id, :id],
        prefix: @prefix,
        where: "mentioner_comment_id IS NOT NULL",
        name: :mentions_comment_outgoing_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_article_id, :id],
        prefix: @prefix,
        where: "mentioned_article_id IS NOT NULL",
        name: :mentions_article_incoming_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_comment_id, :id],
        prefix: @prefix,
        where: "mentioned_comment_id IS NOT NULL",
        name: :mentions_comment_incoming_index
      )
    )

    create(
      index(:artiment_mentions, [:mentioned_user_id, :id],
        prefix: @prefix,
        where: "mentioned_user_id IS NOT NULL",
        name: :mentions_user_incoming_index
      )
    )

    create(
      index(:artiment_mentions, [:external_url_hash],
        prefix: @prefix,
        where: "external_url_hash IS NOT NULL",
        name: :mentions_external_url_index
      )
    )

    execute("""
    CREATE FUNCTION cms.mention_key_part(value text) RETURNS text
    LANGUAGE sql IMMUTABLE AS $$
      SELECT CASE WHEN value IS NULL THEN '-1:' ELSE length(value)::text || ':' || value END
    $$
    """)

    execute("""
    CREATE FUNCTION cms.prepare_artiment_mention() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      source_thread text;
      source_article uuid;
      source_branch bigint;
      target_thread text;
      target_article uuid;
      target_branch bigint;
    BEGIN
      IF NEW.mentioner_type = 'comment' THEN
        SELECT thread, article_id, branch_id INTO source_thread, source_article, source_branch
        FROM cms.comments WHERE id = NEW.mentioner_comment_id;
        IF source_thread IS NULL OR source_branch IS DISTINCT FROM NEW.mentioner_branch_id OR
           (source_thread = 'doc') IS DISTINCT FROM (NEW.mentioner_branch_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Mention source Comment branch mismatch';
        END IF;
      ELSE
        SELECT thread INTO source_thread FROM cms.articles WHERE id = NEW.mentioner_article_id;
        IF source_thread IS DISTINCT FROM NEW.mentioner_type THEN
          RAISE EXCEPTION 'Mention source Article type mismatch';
        END IF;
      END IF;

      IF NEW.mentioned_scope = 'internal' AND NEW.mentioned_type = 'comment' THEN
        SELECT thread, article_id, branch_id INTO target_thread, target_article, target_branch
        FROM cms.comments WHERE id = NEW.mentioned_comment_id;
        IF target_thread IS NULL OR target_branch IS DISTINCT FROM NEW.mentioned_branch_id OR
           (target_thread = 'doc') IS DISTINCT FROM (NEW.mentioned_branch_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Mention target Comment branch mismatch';
        END IF;
      ELSIF NEW.mentioned_scope = 'internal' AND NEW.mentioned_article_id IS NOT NULL THEN
        SELECT thread INTO target_thread FROM cms.articles WHERE id = NEW.mentioned_article_id;
        IF target_thread IS DISTINCT FROM NEW.mentioned_type OR
           (target_thread = 'doc') IS DISTINCT FROM (NEW.mentioned_branch_id IS NOT NULL) THEN
          RAISE EXCEPTION 'Mention target Article type or branch mismatch';
        END IF;
      ELSIF NEW.mentioned_branch_id IS NOT NULL THEN
        RAISE EXCEPTION 'Mention target branch requires Doc';
      END IF;

      NEW.edge_key :=
        cms.mention_key_part(NEW.mentioner_type) ||
        cms.mention_key_part(NEW.mentioner_article_id::text) ||
        cms.mention_key_part(NEW.mentioner_comment_id::text) ||
        cms.mention_key_part(NEW.mentioner_branch_id::text) ||
        cms.mention_key_part(NEW.mentioned_scope) ||
        cms.mention_key_part(NEW.mentioned_type) ||
        cms.mention_key_part(NEW.mentioned_article_id::text) ||
        cms.mention_key_part(NEW.mentioned_comment_id::text) ||
        cms.mention_key_part(NEW.mentioned_user_id::text) ||
        cms.mention_key_part(NEW.mentioned_branch_id::text) ||
        cms.mention_key_part(NEW.external_url_hash) ||
        cms.mention_key_part(NEW.mention_case);
      RETURN NEW;
    END
    $$
    """)

    execute("""
    CREATE TRIGGER artiment_mention_prepare BEFORE INSERT OR UPDATE
    ON cms.artiment_mentions FOR EACH ROW EXECUTE FUNCTION cms.prepare_artiment_mention()
    """)
  end

  def down do
    execute("DROP TRIGGER artiment_mention_prepare ON cms.artiment_mentions")
    execute("DROP FUNCTION cms.prepare_artiment_mention()")
    execute("DROP FUNCTION cms.mention_key_part(text)")
    drop(table(:artiment_mentions, prefix: @prefix))
  end
end
