defmodule GroupherServer.Support.FakeData do
  @moduledoc """
  Test/support fake data helpers.

  These functions provide sample payloads for factories, tests, and local
  support code outside production flows. Values may include randomized picks and
  monotonic unique suffixes so callers can avoid fixture collisions.

  Business position:

      Test case
        -> FakeData
        -> endpoint / fixture / Repo
  """

  @first_names ~w(Ada Alan Grace Linus Yukihiro Jose Sophie Alex Morgan Taylor)
  @companies ~w(Orbit Labs CoderPlanets Byte Garden Graph Studio Kernel Works)
  @cheeses ~w(cheddar gouda brie ricotta mozzarella parmesan feta)
  @words ~w(
    community article comment dashboard editor graph schema profile thread tag
    mention publish update reader author digest content planet signal
  )

  @doc "Returns a randomized sample first name."
  def first_name, do: pick(@first_names)

  @doc "Returns a sample company name with a collision-resistant suffix."
  def company_name, do: "#{pick(@companies)} #{unique_num()}"

  @doc "Returns a unique example.com email address."
  def email, do: "faker_#{unique_num()}@example.com"

  @doc "Returns a unique example.com avatar URL."
  def image_url, do: "https://example.com/avatar/#{unique_num()}.png"

  @doc "Returns a randomized cheese fixture value."
  def cheese, do: pick(@cheeses)

  @doc "Returns a collision-resistant sample profile sentence."
  def shakespeare do
    "A local mock profile for tests and seed data #{unique_num()}."
  end

  @doc "Builds a randomized sentence containing the requested number of fixture words."
  def sentence(word_count \\ 10) when is_integer(word_count) and word_count > 0 do
    words = Enum.map_join(1..word_count, " ", fn _ -> pick(@words) end)

    "#{String.capitalize(words)}."
  end

  defp pick(list), do: Enum.random(list)

  defp unique_num, do: System.unique_integer([:positive, :monotonic])
end
