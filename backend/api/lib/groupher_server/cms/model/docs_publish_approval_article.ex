defmodule GroupherServer.CMS.Model.DocsPublishApprovalArticle do
  @moduledoc """
  The exact immutable Article Snapshot covered by a Docs approval.

      approval + Article -> approved Snapshot -> Release selection
  """

  use Ecto.Schema
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "docs_publish_approval_articles" do
    field(:approval_id, Ecto.UUID, primary_key: true)
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:snapshot_id, Ecto.UUID)
  end
end
