defmodule GroupherServer.Repo.Migrations.UseReviewHoldVocabulary do
  use Ecto.Migration

  @cms "cms"
  @tables ~w(article_review_blocks comment_review_blocks doc_review_blocks)
  @types "'ai_review_hold', 'human_review_hold', 'ai_suspect_hold', 'manual_hold', 'report_threshold_hold'"
  @sources "'request', 'human', 'domain'"

  def up do
    {:ok, :pass} = GroupherServer.CMS.Review.VocabularyGuard.assert_current!()

    Enum.each(@tables, fn table ->
      drop(constraint(table, :cms_review_restriction_type_check, prefix: @cms))

      create(
        constraint(table, :cms_review_restriction_type_check,
          check: "type IN (#{@types})",
          prefix: @cms
        )
      )

      drop(constraint(table, :cms_review_restriction_source_check, prefix: @cms))

      create(
        constraint(table, :cms_review_restriction_source_check,
          check: "source IN (#{@sources})",
          prefix: @cms
        )
      )
    end)
  end

  def down do
    raise "CMS review vocabulary cutover is irreversible; restore the pre-cutover database instead."
  end
end
