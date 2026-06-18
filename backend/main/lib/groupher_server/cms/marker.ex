defmodule GroupherServer.CMS.Marker do
  @moduledoc """
  Shared visual marker contract for tag and docs tree icons.
  """

  import Ecto.Changeset

  @providers ~w(fa lucide heroicons phosphor dev)

  @type marker :: %{
          required(:type) => :icon | :emoji,
          optional(:provider) => String.t(),
          optional(:name) => String.t(),
          optional(:src) => String.t(),
          optional(:unified) => String.t()
        }

  @spec normalize_changeset(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def normalize_changeset(changeset, field \\ :marker) do
    case get_change(changeset, field, :__missing__) do
      :__missing__ ->
        changeset

      nil ->
        put_change(changeset, field, nil)

      value ->
        case normalize(value) do
          {:ok, marker} -> put_change(changeset, field, marker)
          {:error, message} -> add_error(changeset, field, message)
        end
    end
  end

  @spec normalize(map()) :: {:ok, marker()} | {:error, String.t()}
  def normalize(%{} = marker) do
    case marker_type(marker) do
      :icon -> normalize_icon(marker)
      :emoji -> normalize_emoji(marker)
      _ -> {:error, "marker type is invalid"}
    end
  end

  def normalize(_), do: {:error, "marker is invalid"}

  @spec field(map() | nil, atom()) :: term()
  def field(nil, _field), do: nil

  def field(marker, :type) when is_map(marker) do
    marker_type(marker)
  end

  def field(marker, field) when is_map(marker) do
    raw_field(marker, field)
  end

  defp normalize_icon(marker) do
    with {:ok, provider} <- required_string(marker, :provider),
         :ok <- validate_provider(provider),
         {:ok, name} <- required_string(marker, :name),
         {:ok, src} <- required_string(marker, :src) do
      {:ok, %{type: :icon, provider: provider, name: name, src: src}}
    end
  end

  defp validate_provider(provider) when provider in @providers, do: :ok
  defp validate_provider(_provider), do: {:error, "marker provider is invalid"}

  defp normalize_emoji(marker) do
    with {:ok, unified} <- required_string(marker, :unified) do
      {:ok, %{type: :emoji, unified: unified}}
    end
  end

  defp marker_type(marker) do
    marker
    |> raw_field(:type)
    |> case do
      :icon -> :icon
      :emoji -> :emoji
      "ICON" -> :icon
      "EMOJI" -> :emoji
      "icon" -> :icon
      "emoji" -> :emoji
      _ -> nil
    end
  end

  defp raw_field(marker, field) do
    Map.get(marker, field) || Map.get(marker, Atom.to_string(field))
  end

  defp required_string(marker, field) do
    marker
    |> field(field)
    |> case do
      value when is_binary(value) ->
        value = String.trim(value)
        if value == "", do: {:error, "marker #{field} is required"}, else: {:ok, value}

      _ ->
        {:error, "marker #{field} is required"}
    end
  end
end
