defmodule GroupherServer.CMS.ViewTracker.Model.ViewSummary do
  @moduledoc """
  Current Article view total owned by ViewTracker.

      counted ViewEvents -> ViewTracker.Project -> ViewSummary
  """

  use Ecto.Schema

  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "article_view_summaries" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:views, :integer, default: 0)
    field(:revision, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end
end
