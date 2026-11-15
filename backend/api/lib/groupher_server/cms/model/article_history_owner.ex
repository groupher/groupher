defmodule GroupherServer.CMS.Model.ArticleHistoryOwner do
  @moduledoc """
  Retains ordinary Article history ownership after a Binding or Trash entry is removed.

      Article Binding removal -> history owner -> Community history purge

  This generic retention also applies to Docs Articles. Docs Release owns each site's
  immutable publication history; this table only protects per-community Article history
  and does not designate a single site or grant active read access.
  """
  use Ecto.Schema
  @schema_prefix "cms"
  @primary_key false
  schema "article_history_owners" do
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:community_id, :integer, primary_key: true)
  end
end
