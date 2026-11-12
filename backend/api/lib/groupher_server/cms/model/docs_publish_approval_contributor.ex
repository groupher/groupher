defmodule GroupherServer.CMS.Model.DocsPublishApprovalContributor do
  @moduledoc """
  A fixed contributor included in one Docs approval's self-approval check.

      active Queue contributors -> approval snapshot -> immutable author set
  """
  use Ecto.Schema
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()
  schema "docs_publish_approval_contributors" do
    field(:approval_id, Ecto.UUID, primary_key: true)
    field(:user_id, :integer, primary_key: true)
  end
end
