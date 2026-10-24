defmodule GroupherServer.AI.OpinionOutput do
  @moduledoc """
  Strict, limited moderation opinion returned by an AI provider.

  Business position:

      AI provider response
        -> OpinionOutput validates status, evidence and coverage
          -> CMS applies the opinion
  """

  @enforce_keys [:status, :sus_notes, :coverage, :summary]
  defstruct [:status, :sus_notes, :coverage, :summary, :provider_request_id]

  @statuses ~w(clear suspect uncertain)a
  @note_types ~w(spam harassment illegal_content impersonation other)
  @coverage_values ~w(complete unsupported failed)a

  @type t :: %__MODULE__{
          status: :clear | :suspect | :uncertain,
          sus_notes: [map()],
          coverage: %{optional(:text | :image) => :complete | :unsupported | :failed},
          summary: String.t(),
          provider_request_id: String.t() | nil
        }

  @doc "Validates the complete response and coverage required by the submitted input."
  @spec validate(map(), GroupherServer.AI.OpinionInput.t()) ::
          {:ok, t()} | {:error, term()}
  def validate(payload, input) when is_map(payload) do
    with true <-
           MapSet.new(Map.keys(payload)) ==
             MapSet.new(["status", "susNotes", "coverage", "summary"]),
         status when status in @statuses <- normalize_status(payload["status"]),
         {:ok, notes} <- validate_notes(payload["susNotes"]),
         {:ok, coverage} <- validate_coverage(payload["coverage"], input),
         summary when is_binary(summary) and byte_size(summary) <= 2_000 <- payload["summary"],
         true <- valid_opinion?(status, notes, coverage, input) do
      {:ok, %__MODULE__{status: status, sus_notes: notes, coverage: coverage, summary: summary}}
    else
      _ -> {:error, :provider_protocol_error}
    end
  end

  def validate(_payload, _input), do: {:error, :provider_protocol_error}

  defp normalize_status(value) when value in ["clear", "suspect", "uncertain"] do
    String.to_existing_atom(value)
  end

  defp normalize_status(_value), do: nil

  defp validate_notes(notes) when is_list(notes) and length(notes) <= 20 do
    normalized = Enum.map(notes, &normalize_note/1)

    if Enum.all?(normalized, &is_map/1) do
      {:ok, normalized}
    else
      {:error, :provider_protocol_error}
    end
  end

  defp validate_notes(_notes), do: {:error, :provider_protocol_error}

  defp normalize_note(
         %{"type" => type, "evidence" => evidence, "explanation" => explanation} = note
       )
       when map_size(note) == 3 and is_binary(evidence) and byte_size(evidence) <= 500 and
              is_binary(explanation) and byte_size(explanation) <= 1_000 do
    if type in @note_types do
      %{type: type, evidence: evidence, explanation: explanation}
    end
  end

  defp normalize_note(_note), do: nil

  defp validate_coverage(%{"text" => text, "image" => image} = coverage, input)
       when map_size(coverage) == 2 do
    normalized = %{text: normalize_coverage(text), image: normalize_coverage(image)}

    if Enum.all?(Map.values(normalized), &(&1 in @coverage_values)) and
         Enum.all?(input.required_modalities, &(Map.fetch!(normalized, &1) == :complete)) do
      {:ok, normalized}
    else
      {:error, :provider_protocol_error}
    end
  end

  defp validate_coverage(_coverage, _input), do: {:error, :provider_protocol_error}

  defp normalize_coverage(value) when value in ["complete", "unsupported", "failed"] do
    String.to_existing_atom(value)
  end

  defp normalize_coverage(_value), do: nil

  defp valid_opinion?(:clear, [], _coverage, _input), do: true
  defp valid_opinion?(:suspect, [_ | _], _coverage, _input), do: true
  defp valid_opinion?(:uncertain, _notes, _coverage, _input), do: true
  defp valid_opinion?(_status, _notes, _coverage, _input), do: false
end
