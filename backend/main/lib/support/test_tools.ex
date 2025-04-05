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

      @now Timex.now() |> DateTime.truncate(:second)

      @last_week Timex.shift(Timex.beginning_of_week(@now), days: -1)
                 |> DateTime.truncate(:second)

      @last_month Timex.beginning_of_month(Timex.shift(@now, months: -1))
                  |> DateTime.truncate(:second)

      @last_year Timex.end_of_year(Timex.shift(@now, years: -1))
                 |> DateTime.truncate(:second)
    end
  end
end
