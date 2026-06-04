defmodule GroupherServer.Support.FakeData do
  @moduledoc false

  @first_names ~w(Ada Alan Grace Linus Yukihiro Jose Sophie Alex Morgan Taylor)
  @companies ~w(Orbit Labs CoderPlanets Byte Garden Graph Studio Kernel Works)
  @cheeses ~w(cheddar gouda brie ricotta mozzarella parmesan feta)
  @words ~w(
    community article comment dashboard editor graph schema profile thread tag
    mention publish update reader author digest content planet signal
  )

  def first_name, do: pick(@first_names)

  def company_name, do: "#{pick(@companies)} #{unique_num()}"

  def email, do: "faker_#{unique_num()}@example.com"

  def image_url, do: "https://example.com/avatar/#{unique_num()}.png"

  def cheese, do: pick(@cheeses)

  def shakespeare do
    "A local mock profile for tests and seed data #{unique_num()}."
  end

  def sentence(word_count \\ 10) when is_integer(word_count) and word_count > 0 do
    words =
      1..word_count
      |> Enum.map(fn _ -> pick(@words) end)
      |> Enum.join(" ")

    "#{String.capitalize(words)}."
  end

  defp pick(list), do: Enum.random(list)

  defp unique_num, do: System.unique_integer([:positive, :monotonic])
end
