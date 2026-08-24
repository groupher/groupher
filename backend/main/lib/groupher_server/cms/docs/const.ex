defmodule GroupherServer.CMS.Docs.Const do
  @moduledoc """
  Closed Docs branch and snapshot vocabulary.

      Docs command -> Docs.Const -> branch and snapshot persistence
  """

  use GroupherServer.Const

  enum(doc_branch_type, do: [main: :main, preview: :preview])
  enum(doc_branch_status, do: [active: :active, archived: :archived])

  enum doc_snapshot_action do
    [
      checkpoint: :checkpoint,
      publish: :publish,
      fork: :fork,
      promote: :promote,
      restore: :restore
    ]
  end
end
