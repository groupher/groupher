defmodule Helper.Utils.String do
  @moduledoc """
  string utils
  """

  def stringify(v) when is_binary(v), do: v
  def stringify(v) when is_integer(v), do: to_string(v)
  def stringify(v) when is_atom(v), do: to_string(v)
  def stringify(v), do: v

  # see https://stackoverflow.com/a/49558074/4050784
  @spec str_occurrence(String.t(), String.t()) :: integer()
  def str_occurrence(string, substr) when is_binary(string) and is_binary(substr) do
    len = string |> String.split(substr) |> length()
    len - 1
  end

  def str_occurrence(_, _), do: "must be strings"

  @doc """
  ["a", "b", "c", "c"] => %{"a" => 1, "b" => 1, "c" => 2}
  """
  def count_words(words) when is_list(words) do
    Enum.reduce(words, %{}, &update_word_count/2)
  end

  defp update_word_count(word, acc) do
    Map.update(acc, to_string(word), 1, &(&1 + 1))
  end
end
