defmodule GroupherServer.CMS.Model.Embeds.DashboardHeaderLink do
  @type t :: %__MODULE__{}

  @moduledoc false
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Embeds.DashboardHeaderLinkChild

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:type, Ecto.Enum, values: [:link, :group])
    field(:title, :string)
    field(:url, :string)

    embeds_many(:links, DashboardHeaderLinkChild, on_replace: :delete)
  end

  def default, do: []

  def changeset(struct, params) do
    struct
    |> cast(params, [:id, :type, :title, :url])
    |> cast_embed(:links, with: &DashboardHeaderLinkChild.changeset/2)
    |> validate_required([:id, :type, :title])
    |> validate_by_type()
  end

  defp validate_by_type(%Ecto.Changeset{} = changeset) do
    case get_field(changeset, :type) do
      :link ->
        changeset
        |> validate_required([:url])
        |> validate_change(:links, fn :links, links ->
          if Enum.empty?(links), do: [], else: [links: "must be empty for link items"]
        end)

      :group ->
        changeset

      _ ->
        changeset
    end
  end
end
