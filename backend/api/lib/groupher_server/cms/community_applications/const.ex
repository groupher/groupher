defmodule GroupherServer.CMS.CommunityApplications.Const do
  @moduledoc """
  Closed community-application input vocabulary.

      Application input -> CommunityApplications.Const -> review workflow
  """

  use GroupherServer.Const

  enum(apply_category, do: [web: "WEB"])
end
