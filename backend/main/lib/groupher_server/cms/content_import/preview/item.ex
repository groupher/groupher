defmodule GroupherServer.CMS.ContentImport.Preview.Item do
  @moduledoc "One safe, thread-typed item exposed by an import Preview projection."

  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPreview, as: ChangelogItemPreview
  alias GroupherServer.CMS.ContentImport.Threads.Doc.ItemPreview, as: DocItemPreview

  @enforce_keys [:external_ref, :target_ref, :action, :payload]
  defstruct [:external_ref, :target_ref, :action, :payload]

  @type payload :: DocItemPreview.t() | ChangelogItemPreview.t()
  @type t :: %__MODULE__{
          external_ref: String.t(),
          target_ref: String.t(),
          action: Plan.Item.action(),
          payload: payload()
        }

  @spec from_plan_item(Plan.Item.t(), payload()) :: t()
  def from_plan_item(%Plan.Item{} = item, payload) do
    %__MODULE__{
      external_ref: item.external_ref,
      target_ref: item.target_ref,
      action: item.action,
      payload: payload
    }
  end
end
