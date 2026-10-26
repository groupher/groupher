defmodule GroupherServer.AI do
  @moduledoc """
  Shared model-provider capability used by business contexts.

      content + policy input -> configured provider -> validated opinion

  This module has no content, policy, account, or persistence ownership.
  """

  alias GroupherServer.AI
  alias AI.{Config, OpinionInput, OpinionOutput}

  @doc "Validates and builds one provider opinion request."
  defdelegate new_opinion_input(attrs), to: OpinionInput, as: :new

  @doc "Returns the shared unsupported-media error."
  def unsupported_media_error, do: GroupherServer.AI.ErrorCat.unsupported_media()

  @doc "Checks content against one policy through the operations-selected profile."
  @spec check(OpinionInput.t()) :: {:ok, OpinionOutput.t()} | {:error, term()}
  def check(%OpinionInput{} = input) do
    with {:ok, profile} <- Config.review_profile(input.required_modalities),
         {:ok, adapter} <- Config.adapter(profile),
         {:ok, %OpinionOutput{} = output} <- adapter.check(input, profile) do
      {:ok, output}
    end
  end

  def check(_input), do: {:error, GroupherServer.AI.ErrorCat.invalid_config()}
end
