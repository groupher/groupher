defmodule GroupherServer.CMS.ContentImport.Preview do
  @moduledoc "Safe, discriminated projection consumed by GraphQL and thread Preview renderers."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Preview}

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.ItemPreview,
    as: ChangelogItemPreview

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.PreviewPayload, as: ChangelogPreview
  alias GroupherServer.CMS.ContentImport.Threads.Doc.ItemPreview, as: DocItemPreview
  alias GroupherServer.CMS.ContentImport.Threads.Doc.PreviewPayload, as: DocPreview

  @enforce_keys [:thread, :schema_version, :payload, :items]
  defstruct [:thread, :schema_version, :payload, items: [], diagnostics: []]

  @type payload :: DocPreview.t() | ChangelogPreview.t()
  @type t :: %__MODULE__{
          thread: :doc | :changelog,
          schema_version: pos_integer(),
          payload: payload(),
          items: [Preview.Item.t()],
          diagnostics: [Diagnostic.t() | map()]
        }

  @spec new(atom(), pos_integer(), payload(), [Preview.Item.t()], list()) ::
          {:ok, t()} | {:error, Diagnostic.t()}
  def new(thread, schema_version, payload, items, diagnostics \\ []) do
    if valid_payload?(thread, payload) and is_integer(schema_version) and schema_version > 0 and
         valid_items?(thread, items) and is_list(diagnostics) do
      {:ok,
       %__MODULE__{
         thread: thread,
         schema_version: schema_version,
         payload: payload,
         items: items,
         diagnostics: diagnostics
       }}
    else
      Diagnostic.error_result(
        "invalid_thread_preview",
        "Preview payload and items must match the selected thread"
      )
    end
  end

  defp valid_payload?(:doc, %DocPreview{}), do: true
  defp valid_payload?(:changelog, %ChangelogPreview{}), do: true
  defp valid_payload?(_thread, _payload), do: false

  defp valid_items?(:doc, items) when is_list(items) do
    Enum.all?(items, fn item ->
      match?(%Preview.Item{payload: %DocItemPreview{}}, item)
    end)
  end

  defp valid_items?(:changelog, items) when is_list(items) do
    Enum.all?(items, fn item ->
      match?(%Preview.Item{payload: %ChangelogItemPreview{}}, item)
    end)
  end

  defp valid_items?(_thread, _items), do: false
end
