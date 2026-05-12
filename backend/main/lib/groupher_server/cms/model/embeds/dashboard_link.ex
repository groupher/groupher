defmodule GroupherServer.CMS.Model.Embeds.DashboardLink do
  @type t :: %__MODULE__{}

  @moduledoc false
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Embeds.DashboardLinkChild

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:type, Ecto.Enum, values: [:link, :group])
    field(:title, :string)
    field(:url, :string)

    embeds_many(:links, DashboardLinkChild, on_replace: :delete)
  end

  def default, do: []

  def changeset(struct, params) do
    struct
    |> cast(params, [:id, :type, :title, :url])
    |> cast_embed(:links, with: &DashboardLinkChild.changeset/2)
    |> validate_required([:id, :type, :title])
    |> validate_by_type()
  end

  defp validate_by_type(%Ecto.Changeset{} = changeset) do
    case get_field(changeset, :type) do
      :link ->
        changeset
        |> validate_required([:url])
        |> validate_empty_links()

      :group ->
        changeset
        |> validate_empty_url()

      _ ->
        changeset
    end
  end

  defp validate_empty_links(%Ecto.Changeset{} = changeset) do
    links = get_field(changeset, :links) || []

    if Enum.empty?(links) do
      changeset
    else
      add_error(changeset, :links, "must be empty for link items")
    end
  end

  defp validate_empty_url(%Ecto.Changeset{} = changeset) do
    case get_field(changeset, :url) do
      url when url in [nil, ""] -> changeset
      _ -> add_error(changeset, :url, "must be empty for group items")
    end
  end
end
