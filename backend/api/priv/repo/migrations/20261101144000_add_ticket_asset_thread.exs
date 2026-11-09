defmodule GroupherServer.Repo.Migrations.AddTicketAssetThread do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute(
      "ALTER TABLE #{@cms}.community_assets DROP CONSTRAINT IF EXISTS community_assets_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.community_assets
    ADD CONSTRAINT community_assets_thread_check
    CHECK (thread IS NULL OR thread IN ('post', 'blog', 'changelog', 'doc', 'ticket'))
    """)
  end

  def down do
    execute(
      "ALTER TABLE #{@cms}.community_assets DROP CONSTRAINT IF EXISTS community_assets_thread_check"
    )

    execute("""
    ALTER TABLE #{@cms}.community_assets
    ADD CONSTRAINT community_assets_thread_check
    CHECK (thread IS NULL OR thread IN ('post', 'blog', 'changelog', 'doc'))
    """)
  end
end
