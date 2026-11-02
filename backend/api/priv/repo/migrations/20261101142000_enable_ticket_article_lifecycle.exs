defmodule GroupherServer.Repo.Migrations.EnableTicketArticleLifecycle do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
    ADD CONSTRAINT article_lifecycles_thread_check
    CHECK (thread IN ('post', 'blog', 'changelog', 'ticket'))
    """)

    execute("DROP TRIGGER IF EXISTS reject_ordinary_ticket_row ON #{@cms}.article_lifecycles")
  end

  def down do
    execute("""
    CREATE TRIGGER reject_ordinary_ticket_row
    BEFORE INSERT OR UPDATE OF article_id ON #{@cms}.article_lifecycles
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.reject_ordinary_ticket_row()
    """)

    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
    ADD CONSTRAINT article_lifecycles_thread_check
    CHECK (thread IN ('post', 'blog', 'changelog'))
    """)
  end
end
