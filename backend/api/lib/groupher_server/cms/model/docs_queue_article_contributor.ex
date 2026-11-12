defmodule GroupherServer.CMS.Model.DocsQueueArticleContributor do
  @moduledoc """
  An actor contributing to one active Doc Queue member.

      member enqueue / content change -> distinct contributor -> approval eligibility
  """

  use Ecto.Schema

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "docs_queue_article_contributors" do
    field(:queue_id, Ecto.UUID, primary_key: true)
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:user_id, :integer, primary_key: true)
  end
end
