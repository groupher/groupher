defmodule GroupherServer.CMS.Seeds.Threads do
  @moduledoc false

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
end
