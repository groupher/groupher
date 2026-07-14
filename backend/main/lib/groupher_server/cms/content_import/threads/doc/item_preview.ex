defmodule GroupherServer.CMS.ContentImport.Threads.Doc.ItemPreview do
  @moduledoc "Safe Doc item preview without normalized body or private asset locators."

  alias GroupherServer.CMS.ContentImport.Threads.Doc.ItemPayload

  @enforce_keys [:content_status]
  defstruct [:title, :slug, :route, :content_status]

  @type t :: %__MODULE__{
          title: String.t() | nil,
          slug: String.t() | nil,
          route: String.t() | nil,
          content_status: String.t() | nil
        }

  @spec from_item_payload(ItemPayload.t()) :: t()
  def from_item_payload(%ItemPayload{} = payload) do
    %__MODULE__{
      title: payload.title,
      slug: payload.slug,
      route: payload.route,
      content_status: payload.content["status"]
    }
  end
end
