defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ.Group do
  @moduledoc """
  A titled section in the grouped dashboard docs FAQ view.

  Groups are used only by `DocFAQ.group_items`. The flat FAQ view stores its
  questions directly in `DocFAQ.flat_items`, so there is no hidden default group
  persisted for flat mode.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:title, :string, default: "")
    field(:index, :integer, default: 0)

    embeds_many(:items, DocFAQ.Item, on_replace: :delete)
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [:id, :title, :index])
    |> cast_embed(:items, with: &DocFAQ.Item.changeset/2)
  end
end
