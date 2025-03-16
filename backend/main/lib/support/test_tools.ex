defmodule GroupherServer.TestTools do
  @moduledoc """
  helper for reduce import modules in test files
  """
  use ExUnit.CaseTemplate

  using do
    quote do
      use GroupherServerWeb.ConnCase, async: true

      import GroupherServer.Support.Factory
      import GroupherServer.Test.ConnSimulator
      import GroupherServer.Test.AssertHelper
      import Ecto.Query, warn: false
      import Helper.ErrorCode

      import Helper.Utils,
        only: [camelize_map_key: 1, camelize_map_key: 2, get_config: 2, preload_author: 1]

      import ShortMaps

      alias GroupherServer.Test.Helper.Schema
      alias Helper.{Constant, ORM}
      alias GroupherServer.{Accounts, CMS, Repo, FrontDesk}
      alias CMS.Model.{Community, Author, Post, Changelog, Blog, Doc, Embeds, Comment}

      alias GroupherServer.Accounts.Model.User
    end
  end
end
