defmodule GroupherServer.CMS.DocCover.Const do
  @moduledoc """
  Closed Docs Cover view vocabulary.

      Docs Cover request -> DocCover.Const -> public/dashboard projection
  """

  use GroupherServer.Const

  enum(cover_view, do: [public: :public, dashboard: :dashboard])
end
