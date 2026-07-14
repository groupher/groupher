defmodule GroupherServer.CMS.ContentImport.Threads.Changelog.PreviewPayload do
  @moduledoc "Safe Changelog-level preview payload projected from a private Changelog Plan."

  alias GroupherServer.CMS.ContentImport.Threads.Changelog.PlanPayload

  @enforce_keys [:source, :target]
  defstruct [:source, :target]

  @type t :: %__MODULE__{source: map(), target: map()}

  @spec from_plan_payload(PlanPayload.t()) :: t()
  def from_plan_payload(%PlanPayload{} = payload) do
    %__MODULE__{source: payload.source, target: payload.target}
  end
end
