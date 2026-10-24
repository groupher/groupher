defmodule GroupherServer.AI.OpinionInput do
  @moduledoc """
  Validated moderation content and one scope's policy, without CMS identity.

  Business position:

      CMS fixes content and policy
        -> OpinionInput validates provider-safe fields
          -> AI.check/1
  """

  @enforce_keys [:system_prompt, :prompt, :ban_words, :text, :required_modalities]
  defstruct [:system_prompt, :prompt, :ban_words, :text, :images, :required_modalities]

  @type t :: %__MODULE__{
          system_prompt: String.t(),
          prompt: String.t(),
          ban_words: [String.t()],
          text: %{title: String.t(), body: String.t()},
          images: [map()] | nil,
          required_modalities: [:text | :image]
        }

  @doc "Builds an AI request that contains content and policy but no resource/request identifiers."
  @spec new(map()) :: {:ok, t()} | {:error, term()}
  def new(attrs) when is_map(attrs) do
    input = struct(__MODULE__, attrs)

    if valid?(input) do
      {:ok, input}
    else
      {:error, GroupherServer.AI.ErrorCat.invalid_opinion_input()}
    end
  rescue
    ArgumentError -> {:error, GroupherServer.AI.ErrorCat.invalid_opinion_input()}
  end

  def new(_attrs), do: {:error, GroupherServer.AI.ErrorCat.invalid_opinion_input()}

  defp valid?(%__MODULE__{} = input) do
    is_binary(input.system_prompt) and input.system_prompt != "" and
      is_binary(input.prompt) and is_list(input.ban_words) and
      length(input.ban_words) <= 10_000 and
      Enum.all?(input.ban_words, &(is_binary(&1) and byte_size(&1) <= 128)) and
      is_binary(input.text.title) and is_binary(input.text.body) and
      is_list(input.required_modalities) and input.required_modalities != [] and
      Enum.all?(input.required_modalities, &(&1 in [:text, :image])) and
      is_list(input.images || []) and length(input.images || []) <= 10
  rescue
    _ -> false
  end
end
