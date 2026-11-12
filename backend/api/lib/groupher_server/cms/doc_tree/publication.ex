defmodule GroupherServer.CMS.DocTree.Publication do
  @moduledoc """
  Provides version-bound Docs preview, approval presentation and history reads.

      CMS facade -> Publication Query -> site Gate -> consistent projection
  """
  alias __MODULE__.Query
  @doc "Reads the complete target site preview."
  defdelegate preview(site, actor, opts), to: Query
  @doc "Reads an explicit public or approval comparison."
  defdelegate diff(site, actor, opts), to: Query
  @doc "Reads release summaries."
  defdelegate releases(site, actor, opts), to: Query
  @doc "Reads an authorized release detail."
  defdelegate release(site, actor, id, article_id), to: Query
  @doc "Reads one Article's immutable history."
  defdelegate snapshots(site, actor, article_id, opts), to: Query
  @doc "Reads approval policy under configuration permission."
  defdelegate policy(site, actor), to: Query
end
