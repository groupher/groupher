defmodule GroupherServer.CMS.Articles.Commands.Archive do
  @moduledoc """
  Owns Article thread archive state routing.

      Article archive command -> Gate/state transition -> tagged result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS

  alias CMS.Articles.States

  @doc "Archives an Article thread through the internal maintenance pipeline."
  @spec execute(atom()) :: {:ok, term()} | {:error, term()}
  @pipeline operation: :article_archive, target: :thread, access: :internal
  direct_pipeline execute(thread) do
    change(fn _target, _operation_ref -> States.archive(thread) end)
  end
end
