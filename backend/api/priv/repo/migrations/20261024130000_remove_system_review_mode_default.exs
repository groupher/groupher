defmodule GroupherServer.Repo.Migrations.RemoveSystemReviewModeDefault do
  use Ecto.Migration

  @review_bot "review_bot"

  def up do
    execute("ALTER TABLE #{@review_bot}.review_bot_configs ALTER COLUMN review_mode DROP DEFAULT")
  end

  def down do
    execute(
      "ALTER TABLE #{@review_bot}.review_bot_configs ALTER COLUMN review_mode SET DEFAULT 'immediate'"
    )
  end
end
