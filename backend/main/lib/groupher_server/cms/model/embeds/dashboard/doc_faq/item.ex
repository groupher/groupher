defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ.Item do
  @moduledoc """
  A single dashboard docs FAQ question.

  `title` is the question shown in the FAQ list. `detail` is the markdown answer
  edited from the dashboard FAQ editor. `index` stores the persisted order inside
  either a grouped section or the flat FAQ list.
  """
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field(:id, :string)
    field(:title, :string, default: "")
    field(:detail, :string, default: "")
    field(:index, :integer, default: 0)
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [:id, :title, :detail, :index])
  end
end
