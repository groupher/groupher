defmodule GroupherServer.CMS.Review.VocabularyGuard do
  @moduledoc """
  Refuses the hold-vocabulary cutover while retired values remain in storage.

      Review hold tables -> vocabulary guard -> migration may replace checks
  """

  alias GroupherServer.Repo

  @tables ~w(article_review_blocks comment_review_blocks doc_review_blocks)
  @types "'ai_review_hold', 'human_review_hold', 'ai_suspect_hold', 'manual_hold', 'report_threshold_hold'"
  @sources "'request', 'human', 'domain'"

  @doc "Returns `{:ok, :pass}` when every persisted review block uses current values."
  @spec assert_current!() :: {:ok, :pass}
  def assert_current! do
    Enum.each(@tables, fn table ->
      %{rows: [[invalid_count]]} =
        Repo.query!("""
        SELECT count(*)
        FROM cms.#{table}
        WHERE type IS NULL OR type::text NOT IN (#{@types})
           OR source IS NULL OR source::text NOT IN (#{@sources})
        """)

      if invalid_count > 0 do
        raise "Cannot migrate #{table}: #{invalid_count} review block rows use retired type/source values"
      end
    end)

    {:ok, :pass}
  end
end
