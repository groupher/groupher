defmodule Helper.Validator.Slug do
  @moduledoc """
  Shared SEO-friendly URL slug validation.

  Allowed characters:
  - lowercase letters (`a-z`)
  - numbers (`0-9`)
  - hyphen (`-`)

  Slug must start and end with a letter or number.

  ## Examples

      iex> Helper.Validator.Slug.valid?("react-19-guide")
      true

      iex> Helper.Validator.Slug.valid?("react_19_guide")
      false
  """

  import Ecto.Changeset, only: [validate_format: 4]

  @slug_regex ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/

  @spec valid?(String.t()) :: boolean()
  def valid?(slug) when is_binary(slug), do: Regex.match?(@slug_regex, slug)
  def valid?(_), do: false

  @spec normalize(String.t() | term()) :: String.t() | term()
  def normalize(slug) when is_binary(slug) do
    slug
    |> String.trim()
    |> String.downcase()
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/[^a-z0-9]+/u, "-")
    |> String.replace(~r/-{2,}/, "-")
    |> String.replace(~r/^[^a-z0-9]+|[^a-z0-9]+$/, "")
  end

  def normalize(slug), do: slug

  @spec validate_changeset(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def validate_changeset(changeset, field \\ :slug) do
    validate_format(
      changeset,
      field,
      @slug_regex,
      message: "only lowercase letters, numbers and hyphen are allowed"
    )
  end
end
