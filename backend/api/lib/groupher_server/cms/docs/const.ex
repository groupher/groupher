defmodule GroupherServer.CMS.Docs.Const do
  @moduledoc """
  Closed Docs branch vocabulary.

      Docs command -> Docs.Const -> branch persistence
  """

  use GroupherServer.Const

  enum(doc_branch_type, do: [main: :main, preview: :preview])
  enum(doc_branch_status, do: [active: :active, archived: :archived])
end
