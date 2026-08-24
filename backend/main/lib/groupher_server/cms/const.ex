defmodule GroupherServer.CMS.Const do
  @moduledoc """
  Closed vocabulary shared across multiple CMS domains.

  Domain-specific constants belong to their owning modules, such as
  `CMS.Gate.Const`, `CMS.DocTree.Const`, and `CMS.Communities.Const`.

      CMS cross-domain consumer -> CMS.Const -> shared stage vocabulary
  """

  use GroupherServer.Const

  enum(stage, do: [draft: :draft, public: :public])
end
