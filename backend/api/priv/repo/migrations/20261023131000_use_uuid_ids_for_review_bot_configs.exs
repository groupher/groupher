defmodule GroupherServer.Repo.Migrations.UseUuidIdsForReviewBotConfigs do
  use Ecto.Migration

  @review_bot "review_bot"

  def up do
    execute(
      "ALTER TABLE #{@review_bot}.review_bot_configs DROP CONSTRAINT review_bot_configs_pkey"
    )

    execute("ALTER TABLE #{@review_bot}.review_bot_configs ALTER COLUMN id DROP DEFAULT")

    execute("""
    ALTER TABLE #{@review_bot}.review_bot_configs
    ALTER COLUMN id TYPE uuid USING gen_random_uuid()
    """)

    execute("DROP SEQUENCE IF EXISTS #{@review_bot}.review_bot_configs_id_seq")

    execute("""
    ALTER TABLE #{@review_bot}.review_bot_configs
    ADD CONSTRAINT review_bot_configs_pkey PRIMARY KEY (id)
    """)
  end

  def down do
    raise "review_bot_configs ids cannot be converted back to their original values"
  end
end
