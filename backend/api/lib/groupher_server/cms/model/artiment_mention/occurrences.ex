defmodule GroupherServer.CMS.Model.ArtimentMention.Occurrences do
  @moduledoc """
  Stores a nonempty list of occurrence maps in one JSONB column.

      parser occurrences -> Ecto JSONB type -> stable Mention fact
  """

  use Ecto.Type

  def type, do: :map

  def cast(value) when is_list(value) do
    if Enum.all?(value, &is_map/1), do: {:ok, value}, else: :error
  end

  def cast(_), do: :error

  def dump(value), do: cast(value)
  def load(value), do: cast(value)
end
