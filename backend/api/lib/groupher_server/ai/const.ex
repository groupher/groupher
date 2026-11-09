defmodule GroupherServer.AI.Const do
  @moduledoc """
  Closed vocabulary for validated AI review opinions.

      AI provider result
        -> AI.Const values
          -> OpinionOutput validation
  """

  use GroupherServer.Const

  @statuses [:clear, :suspect, :uncertain]
  @note_types [:spam, :harassment, :illegal_content, :impersonation, :other]
  @coverage_values [:complete, :unsupported, :failed]

  enum(status, do: Enum.map(@statuses, &{&1, &1}))

  enum(note_type, do: Enum.map(@note_types, &{&1, Atom.to_string(&1)}))

  enum(coverage, do: Enum.map(@coverage_values, &{&1, &1}))

  def statuses, do: @statuses
  def note_types, do: Enum.map(@note_types, &Atom.to_string/1)
  def coverages, do: @coverage_values
end
