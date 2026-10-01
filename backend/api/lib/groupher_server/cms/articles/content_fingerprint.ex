defmodule GroupherServer.CMS.Articles.ContentFingerprint do
  @moduledoc """
  Builds stable fingerprints for version-owned cover edit snapshots.

      DraftCoverEdit / RevisionCoverEdit
        -> normalized background and image maps
        -> content hash / Draft diff

  Database ids and timestamps are intentionally excluded so copying the same
  cover state between a Draft and a Revision does not look like a content edit.
  """

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    CoverBackground,
    DraftCoverEdit,
    RevisionCoverEdit
  }

  @background_fields ~w(type source asset_public_ref static_asset_public_ref pattern gradient effect texture)a
  @doc "Returns the normalized Draft cover fingerprint for one body Draft, or nil when absent."
  @spec draft(Ecto.UUID.t()) :: map() | nil
  def draft(body_draft_id) do
    case Repo.get(DraftCoverEdit, body_draft_id) do
      %DraftCoverEdit{} = edit -> fingerprint(edit)
      nil -> nil
    end
  end

  @doc "Returns the normalized immutable Revision cover fingerprint, or nil when absent."
  @spec revision(Ecto.UUID.t()) :: map() | nil
  def revision(revision_id) do
    case Repo.get(RevisionCoverEdit, revision_id) do
      %RevisionCoverEdit{} = edit -> fingerprint(edit)
      nil -> nil
    end
  end

  @doc "Normalizes one cover edit struct into a content-only fingerprint."
  @spec fingerprint(DraftCoverEdit.t() | RevisionCoverEdit.t()) :: map()
  def fingerprint(edit) when is_struct(edit) do
    edit =
      Repo.preload(edit, [
        :light_background,
        :light_original_background,
        :dark_background,
        :dark_original_background
      ])

    %{
      canvas_width: edit.canvas_width,
      canvas_height: edit.canvas_height,
      version: edit.version,
      light: %{
        background: background(edit.light_background),
        original_background: background(edit.light_original_background),
        images: edit.light_images || []
      },
      dark: %{
        background: background(edit.dark_background),
        original_background: background(edit.dark_original_background),
        images: edit.dark_images || []
      }
    }
  end

  defp background(nil), do: nil

  defp background(%CoverBackground{} = background),
    do: Map.take(Map.from_struct(background), @background_fields)
end
