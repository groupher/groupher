defmodule GroupherServer.CMS.ContentImport.Threads.Doc.PreviewPayload do
  @moduledoc "Safe Doc-level preview payload projected from a private Doc Plan."

  alias GroupherServer.CMS.ContentImport.Threads.Doc.PlanPayload

  @enforce_keys [:source, :target, :tree]
  defstruct [:source, :target, :tree]

  @type t :: %__MODULE__{source: map(), target: map(), tree: map()}

  @spec from_plan_payload(PlanPayload.t()) :: t()
  def from_plan_payload(%PlanPayload{} = payload) do
    %__MODULE__{source: payload.source, target: payload.target, tree: payload.tree}
  end
end
