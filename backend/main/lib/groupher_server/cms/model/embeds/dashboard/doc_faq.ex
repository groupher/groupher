defmodule GroupherServer.CMS.Model.Embeds.Dashboard.DocFAQ do
  @moduledoc """
  Dashboard docs FAQ configuration.

  The editor supports two independent FAQ views:

  - `group_items` keeps the grouped view as titled sections with ordered FAQ items.
  - `flat_items` keeps the flat view as one ordered list of FAQ items.

  `grouped_view` only selects which view is displayed. It does not convert or
  merge items between the two lists, so users can switch modes without losing the
  previous grouped or flat arrangement. `default/0` returns example content for
  both views so a new docs FAQ is immediately editable instead of starting empty.
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias __MODULE__

  @primary_key false
  embedded_schema do
    field(:title, :string, default: "FAQ")
    field(:desc, :string, default: "")
    field(:grouped_view, :boolean, default: true)

    embeds_many(:group_items, DocFAQ.Group, on_replace: :delete)
    embeds_many(:flat_items, DocFAQ.Item, on_replace: :delete)
  end

  def default do
    %{
      title: "FAQ",
      desc: "Common questions about docs",
      grouped_view: true,
      group_items: [
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
      ],
      flat_items: [
        %{
          id: "faq_get_started",
          title: "How do I get started?",
          detail: "Create your first guide, add a few common questions, then publish the docs.",
          index: 0
        },
        %{
          id: "faq_markdown",
          title: "Can answers use Markdown?",
          detail: "Yes. FAQ answers support markdown formatting, links, and inline code.",
          index: 1
        }
      ]
    }
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [:title, :desc, :grouped_view])
    |> cast_embed(:group_items, with: &DocFAQ.Group.changeset/2)
    |> cast_embed(:flat_items, with: &DocFAQ.Item.changeset/2)
  end
end
