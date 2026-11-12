defmodule GroupherServer.CMS.Model.ArticleHistoryOwner do
  @moduledoc """
  Retains ordinary Article history ownership after a Binding or Trash entry is removed.

      ordinary Binding creation -> history owner -> last Community destroy -> history purge

  Docs retain their single-site identity through DocsHistoryOwner instead.
  """
  use Ecto.Schema
  @schema_prefix "cms"
  @primary_key false
  schema "article_history_owners" do
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:community_id, :integer, primary_key: true)
  end
end
