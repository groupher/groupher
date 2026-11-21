defmodule GroupherServer.CMS.Model.DocsHistoryOwner do
  @moduledoc """
  Keeps the original site of a Doc after its working/public bindings are purged.

      new Doc transaction -> permanent site identity -> authorized Snapshot / Release history
  """
  use Ecto.Schema
  @schema_prefix "cms"
  @primary_key false
  schema "docs_history_owners" do
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:community_id, :integer)
  end
end
