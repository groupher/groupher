defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPreview do
  @moduledoc "Safe Changelog item preview without normalized body or private asset locators."

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPayload

  @enforce_keys [:prerelease, :content_status]
  defstruct [:title, :tag_name, :published_at, :prerelease, :source_url, :content_status]

  @type t :: %__MODULE__{
          title: String.t() | nil,
          tag_name: String.t() | nil,
          published_at: String.t() | nil,
          prerelease: boolean(),
          source_url: String.t() | nil,
          content_status: String.t() | nil
        }

  @spec from_item_payload(ItemPayload.t()) :: t()
  def from_item_payload(%ItemPayload{} = payload) do
    %__MODULE__{
      title: payload.title,
      tag_name: payload.tag_name,
      published_at: payload.published_at,
      prerelease: payload.prerelease,
      source_url: payload.source_url,
      content_status: payload.content["status"]
    }
  end
end
