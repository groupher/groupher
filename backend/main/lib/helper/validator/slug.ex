defmodule Helper.Validator.Slug do
  @moduledoc """
  Shared slug validation for CMS community slugs.

  Allowed characters:
  - lowercase letters (`a-z`)
  - numbers (`0-9`)
  - hyphen (`-`)
  - underscore (`_`)

  Slug must start and end with a letter or number.
  """

  import Ecto.Changeset, only: [validate_format: 4]

  @slug_regex ~r/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/

  @spec valid?(String.t()) :: boolean()
  def valid?(slug) when is_binary(slug), do: Regex.match?(@slug_regex, slug)
  def valid?(_), do: false

  @spec validate_changeset(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def validate_changeset(changeset, field \\ :slug) do
    validate_format(
      changeset,
      field,
      @slug_regex,
      message: "only lowercase letters, numbers, hyphen and underscore are allowed"
    )
  end
end
