defmodule GroupherServer.Repo.Migrations.CreateArticleWorkingCopyThreadFields do
  use Ecto.Migration

  @prefix "cms"

  def change do
    for thread <- ~w(post blog changelog) do
      create table(String.to_atom("article_working_copy_#{thread}s"),
               primary_key: false,
               prefix: @prefix
             ) do
        add(
          :working_copy_id,
          references(:article_working_copies,
            type: :uuid,
            prefix: @prefix,
            on_delete: :delete_all
          ),
          primary_key: true
        )

        add(:copy_right, :text)
        add(:link_addr, :text)
        add(:cover_url, :text)
        add(:cover_url_dark, :text)
        timestamps()
      end
    end

    create table(:article_working_copy_docs, primary_key: false, prefix: @prefix) do
      add(
        :working_copy_id,
        references(:article_working_copies, type: :uuid, prefix: @prefix, on_delete: :delete_all),
        primary_key: true
      )

      add(:subtitle, :text)
      add(:link_addr, :text)
      add(:template_key, :string)
      add(:cover_url, :text)
      add(:cover_url_dark, :text)
      timestamps()
    end

    create_thread_owner_guard()
  end

  defp create_thread_owner_guard do
    execute(
      """
      CREATE OR REPLACE FUNCTION cms.assert_article_working_copy_thread_field_owner()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE owner_thread text; expected_thread text;
      BEGIN
        expected_thread := regexp_replace(TG_TABLE_NAME, '^article_working_copy_(.*)s$', '\\1');
        IF TG_TABLE_NAME = 'article_working_copy_docs' THEN expected_thread := 'doc'; END IF;
        SELECT a.thread INTO owner_thread
        FROM cms.article_working_copies wc
        JOIN cms.articles a ON a.id = wc.article_id
        WHERE wc.id = NEW.working_copy_id;
        IF owner_thread IS DISTINCT FROM expected_thread THEN
          RAISE EXCEPTION 'Article WorkingCopy thread extension does not match Article thread'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
      """,
      "DROP FUNCTION IF EXISTS cms.assert_article_working_copy_thread_field_owner()"
    )

    for table <- ~w(article_working_copy_posts article_working_copy_blogs
                     article_working_copy_changelogs article_working_copy_docs) do
      execute(
        "CREATE TRIGGER #{table}_owner_guard BEFORE INSERT OR UPDATE ON cms.#{table} " <>
          "FOR EACH ROW EXECUTE FUNCTION cms.assert_article_working_copy_thread_field_owner()",
        "DROP TRIGGER IF EXISTS #{table}_owner_guard ON cms.#{table}"
      )
    end
  end
end
