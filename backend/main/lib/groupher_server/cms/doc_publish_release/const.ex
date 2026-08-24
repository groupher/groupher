defmodule GroupherServer.CMS.DocPublishRelease.Const do
  @moduledoc """
  Closed Docs publish-release article action vocabulary.

      Publish diff -> DocPublishRelease.Const -> release article record
  """

  use GroupherServer.Const

  enum release_article_action do
    [
      created: "created",
      modified: "modified",
      deleted: "deleted",
      renamed: "renamed",
      moved: "moved",
      unchanged: "unchanged"
    ]
  end
end
