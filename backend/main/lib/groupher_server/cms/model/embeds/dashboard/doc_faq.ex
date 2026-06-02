defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ.Item do
  @moduledoc false
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

defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ.Group do
  @moduledoc false
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

defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ do
  @moduledoc false
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias __MODULE__

  @primary_key false
  embedded_schema do
    field(:title, :string, default: "FAQ")
    field(:desc, :string, default: "")
    field(:grouped, :boolean, default: true)

    embeds_many(:groups, DocFAQ.Group, on_replace: :delete)
  end

  def default do
    %{
      title: "FAQ",
      desc: "Common questions about docs",
      grouped: true,
      groups: [
        %{
          id: "grp_basics",
          title: "Basics",
          index: 0,
          items: [
            %{
              id: "faq_what_is_docs",
              title: "What are docs for?",
              detail: "Use docs to publish guides, references, and product help.",
              index: 0
            },
            %{
              id: "faq_how_to_update",
              title: "How do I update a question?",
              detail: "Open a question, edit the markdown answer, then save the FAQ.",
              index: 1
            }
          ]
        },
        %{
          id: "grp_publishing",
          title: "Publishing",
          index: 1,
          items: [
            %{
              id: "faq_publish_docs",
              title: "When are FAQ changes visible?",
              detail: "FAQ changes are visible after the dashboard save completes.",
              index: 0
            }
          ]
        }
      ]
    }
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [:title, :desc, :grouped])
    |> cast_embed(:groups, with: &DocFAQ.Group.changeset/2)
  end
end
