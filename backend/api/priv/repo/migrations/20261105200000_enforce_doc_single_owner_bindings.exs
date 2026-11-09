defmodule GroupherServer.Repo.Migrations.EnforceDocSingleOwnerBindings do
  @moduledoc """
  Enforces Doc ownership for canonical commands and direct database writes.

      stable Article type -> binding discriminator + partial UNIQUE
        -> immutable owner -> branch membership and Comment review scope
  """
  use Ecto.Migration

  def up do
    execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM cms.articles) THEN
        RAISE EXCEPTION 'Doc owner constraints require the fresh Article dataset';
      END IF;
    END $$;
    """)

    create(
      unique_index(:articles, [:id, :thread], prefix: "cms", name: :articles_id_thread_unique)
    )

    alter table(:article_bindings, prefix: "cms") do
      add(:thread, :string, null: false)
    end

    execute("""
    ALTER TABLE cms.article_bindings ADD CONSTRAINT article_bindings_article_thread_fkey
      FOREIGN KEY (article_id, thread) REFERENCES cms.articles(id, thread)
      ON UPDATE RESTRICT ON DELETE CASCADE
    """)

    create(
      unique_index(:article_bindings, [:article_id],
        prefix: "cms",
        name: :article_bindings_doc_single_owner_index,
        where: "thread = 'doc'"
      )
    )

    Enum.each(functions(), &execute/1)

    trigger(
      "guard_doc_binding_identity",
      "article_bindings",
      "INSERT OR UPDATE OF article_id, community_id, thread",
      "guard_doc_binding_identity()"
    )

    trigger(
      "guard_article_thread_identity",
      "articles",
      "UPDATE OF thread",
      "guard_immutable_identity('thread')"
    )

    trigger(
      "guard_doc_branch_community",
      "doc_branches",
      "UPDATE OF community_id",
      "guard_immutable_identity('community_id')"
    )

    trigger(
      "guard_doc_binding_delete",
      "article_bindings",
      "DELETE",
      "guard_doc_binding_delete()"
    )

    trigger(
      "guard_doc_owner_community_delete",
      "communities",
      "DELETE",
      "guard_doc_owner_community_delete()"
    )

    trigger(
      "guard_comment_parent_identity",
      "comments",
      "INSERT OR UPDATE OF article_id, thread",
      "guard_comment_parent_identity()"
    )

    for table <-
          ~w(doc_drafts doc_lifecycles doc_branch_states doc_branch_versions doc_branch_version_counters doc_publics doc_review_blocks trashed_doc_articles) do
      trigger(
        "guard_doc_membership_owner",
        table,
        "INSERT OR UPDATE",
        "guard_doc_membership_owner('article_id')"
      )
    end

    for table <- ~w(doc_tree_nodes doc_publish_release_articles) do
      trigger(
        "guard_doc_membership_owner",
        table,
        "INSERT OR UPDATE",
        "guard_doc_membership_owner('doc_id')"
      )
    end
  end

  defp trigger(name, table, event, function) do
    execute(
      "CREATE TRIGGER #{name} BEFORE #{event} ON cms.#{table} FOR EACH ROW EXECUTE FUNCTION cms.#{function}"
    )
  end

  defp functions do
    [
      """
      CREATE FUNCTION cms.guard_doc_binding_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE canonical_thread text;
      BEGIN
        SELECT thread INTO canonical_thread FROM cms.articles WHERE id=NEW.article_id FOR UPDATE;
        IF canonical_thread IS NULL THEN
          RAISE EXCEPTION 'binding parent missing' USING ERRCODE='23503';
        END IF;
        IF NEW.thread IS NOT NULL AND NEW.thread IS DISTINCT FROM canonical_thread THEN
          RAISE EXCEPTION 'binding type mismatch' USING ERRCODE='23514', CONSTRAINT='article_bindings_canonical_thread_check';
        END IF;
        NEW.thread := canonical_thread;
        IF TG_OP='UPDATE' AND (OLD.thread='doc' OR NEW.thread='doc') AND
          (OLD.article_id IS DISTINCT FROM NEW.article_id OR OLD.community_id IS DISTINCT FROM NEW.community_id OR OLD.thread IS DISTINCT FROM NEW.thread) THEN
          RAISE EXCEPTION 'Doc owner is immutable' USING ERRCODE='23514', CONSTRAINT='doc_binding_identity_check';
        END IF;
        RETURN NEW;
      END $$
      """,
      """
      CREATE FUNCTION cms.guard_immutable_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF (to_jsonb(OLD)->TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(NEW)->TG_ARGV[0]) THEN
          RAISE EXCEPTION 'stable identity cannot change' USING ERRCODE='23514', CONSTRAINT='stable_identity_check';
        END IF;
        RETURN NEW;
      END $$
      """,
      """
      CREATE FUNCTION cms.guard_doc_binding_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.thread='doc' AND EXISTS (SELECT 1 FROM cms.articles WHERE id=OLD.article_id) THEN
          RAISE EXCEPTION 'delete stable Doc before owner binding' USING ERRCODE='23503', CONSTRAINT='doc_owner_binding_delete_guard';
        END IF;
        RETURN OLD;
      END $$
      """,
      """
      CREATE FUNCTION cms.guard_doc_owner_community_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM cms.article_bindings b JOIN cms.articles a ON a.id=b.article_id
          WHERE b.community_id=OLD.id AND a.thread='doc') THEN
          RAISE EXCEPTION 'purge stable Docs before owner Community' USING ERRCODE='23503', CONSTRAINT='doc_owner_community_delete_guard';
        END IF;
        RETURN OLD;
      END $$
      """,
      """
      CREATE FUNCTION cms.guard_doc_membership_owner() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE data jsonb; aid uuid; bid bigint; owner_id bigint; branch_owner bigint;
        article_thread text; version_aid uuid; release_branch bigint; release_owner bigint;
      BEGIN
        data := to_jsonb(NEW); aid := (data->>TG_ARGV[0])::uuid;
        IF aid IS NULL THEN RETURN NEW; END IF;
        bid := (data->>'branch_id')::bigint;
        IF TG_TABLE_NAME='doc_publish_release_articles' THEN
          SELECT article_id, branch_id INTO version_aid, bid FROM cms.doc_branch_versions WHERE id=(data->>'branch_version_id')::bigint;
          SELECT branch_id, community_id INTO release_branch, release_owner FROM cms.doc_publish_releases WHERE id=(data->>'release_id')::bigint;
          IF version_aid IS DISTINCT FROM aid OR release_branch IS DISTINCT FROM bid THEN
            RAISE EXCEPTION 'release Doc membership mismatch' USING ERRCODE='23514', CONSTRAINT='doc_membership_owner_check';
          END IF;
        END IF;
        SELECT thread INTO article_thread FROM cms.articles WHERE id=aid FOR UPDATE;
        SELECT community_id INTO owner_id FROM cms.article_bindings WHERE article_id=aid AND thread='doc' FOR KEY SHARE;
        SELECT community_id INTO branch_owner FROM cms.doc_branches WHERE id=bid FOR KEY SHARE;
        IF article_thread IS DISTINCT FROM 'doc' OR owner_id IS NULL OR branch_owner IS DISTINCT FROM owner_id OR
          (data->>'community_id' IS NOT NULL AND (data->>'community_id')::bigint IS DISTINCT FROM owner_id) OR
          (release_owner IS NOT NULL AND release_owner IS DISTINCT FROM owner_id) THEN
          RAISE EXCEPTION 'Doc membership owner mismatch' USING ERRCODE='23514', CONSTRAINT='doc_membership_owner_check';
        END IF;
        RETURN NEW;
      END $$
      """,
      """
      CREATE FUNCTION cms.guard_comment_parent_identity() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE canonical_thread text;
      BEGIN
        SELECT thread INTO canonical_thread FROM cms.articles WHERE id=NEW.article_id FOR KEY SHARE;
        IF canonical_thread IS NULL OR canonical_thread NOT IN ('post','blog','changelog','doc') OR NEW.thread IS DISTINCT FROM canonical_thread THEN
          RAISE EXCEPTION 'Comment parent mismatch' USING ERRCODE='23514', CONSTRAINT='comment_parent_identity_check';
        END IF;
        IF TG_OP='UPDATE' AND (OLD.article_id IS DISTINCT FROM NEW.article_id OR OLD.thread IS DISTINCT FROM NEW.thread) THEN
          RAISE EXCEPTION 'Comment parent is immutable' USING ERRCODE='23514', CONSTRAINT='comment_parent_identity_check';
        END IF;
        RETURN NEW;
      END $$
      """,
      """
      CREATE OR REPLACE FUNCTION cms.enforce_comment_review_block_scope() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE aid uuid; comment_thread text; owner_id bigint;
      BEGIN
        SELECT article_id, thread INTO aid, comment_thread FROM cms.comments WHERE id=NEW.comment_id;
        IF comment_thread='doc' THEN
          SELECT community_id INTO owner_id FROM cms.article_bindings WHERE article_id=aid AND thread='doc';
          IF owner_id IS NULL OR (NEW.community_id IS NOT NULL AND NEW.community_id IS DISTINCT FROM owner_id) THEN
            RAISE EXCEPTION 'Doc Comment block owner mismatch' USING ERRCODE='23514', CONSTRAINT='doc_comment_review_owner_check';
          END IF;
        ELSIF NEW.community_id IS NOT NULL THEN
          RAISE EXCEPTION 'ordinary Comment blocks must be global' USING ERRCODE='23514', CONSTRAINT='comment_review_global_scope_check';
        END IF;
        RETURN NEW;
      END $$
      """
    ]
  end

  def down do
    raise "Doc owner cutover has no legacy binding compatibility mode"
  end
end
