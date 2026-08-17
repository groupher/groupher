defmodule GroupherServer.CMS.Seeds.Threads do
  @moduledoc """
  Seed helpers for enabling community threads.

  The returned thread lists define which product surfaces each seeded community
  exposes in local/demo data.

  Business position:

      Seed task
        -> Threads
        -> CMS context
        -> Repo
  """

  @doc """
  Returns the thread list a seeded community type exposes.

  ## Examples

      CMS.Seeds.Threads.get(:home)
      #=> []

      CMS.Seeds.Threads.get(:feedback)
      #=> [%{slug: "post"}, %{slug: "kanban"}]

  """
  def get(:home), do: []

  def get(:blackhole) do
    [
      %{slug: "post"},
      %{slug: "blog"}
    ]
  end

  def get(:feedback) do
    [
      %{slug: "post"},
      %{slug: "kanban"}
    ]
  end

  def get(:makers) do
    [
      %{slug: "post"}
    ]
  end

  def get(:adwall), do: [%{slug: "post"}]
  def get(:ask), do: [%{slug: "post"}]
  def get(:pl), do: get(:framework)

  def get(:framework) do
    [
      %{slug: "post"},
      %{slug: "blog"}
    ]
  end

  def get(:city), do: [%{slug: "post"}]
  def get(:users), do: []
  def get(_unknown), do: []
end
