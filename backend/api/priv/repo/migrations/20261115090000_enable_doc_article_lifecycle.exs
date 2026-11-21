defmodule GroupherServer.Repo.Migrations.EnableDocArticleLifecycle do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
    ADD CONSTRAINT article_lifecycles_thread_check
    CHECK (thread IN ('post', 'blog', 'changelog', 'doc', 'ticket'))
    """)
  end

  def down do
    execute(
      "ALTER TABLE #{@cms}.article_lifecycles DROP CONSTRAINT IF EXISTS article_lifecycles_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.article_lifecycles
    ADD CONSTRAINT article_lifecycles_thread_check
    CHECK (thread IN ('post', 'blog', 'changelog', 'ticket'))
    """)
  end
end
