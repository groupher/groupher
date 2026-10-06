defmodule GroupherServer.Repo.Migrations.NormalizeStableArticleIllegalReason do
  use Ecto.Migration

  @moduledoc """
  Aligns the stable Article moderation reason with the existing GraphQL list contract.
  """

  def up do
    execute("""
    ALTER TABLE cms.articles
    ALTER COLUMN illegal_reason TYPE text[]
    USING CASE
      WHEN illegal_reason IS NULL OR illegal_reason = '' THEN ARRAY[]::text[]
      ELSE ARRAY[illegal_reason]
    END
    """)

    alter table(:articles, prefix: "cms") do
      modify(:illegal_reason, {:array, :string}, null: false, default: [])
    end
  end

  def down do
    execute("""
    ALTER TABLE cms.articles
    ALTER COLUMN illegal_reason DROP DEFAULT,
    ALTER COLUMN illegal_reason DROP NOT NULL,
    ALTER COLUMN illegal_reason TYPE text
    USING CASE
      WHEN cardinality(illegal_reason) = 0 THEN NULL
      ELSE array_to_string(illegal_reason, ',')
    END
    """)
  end
end
