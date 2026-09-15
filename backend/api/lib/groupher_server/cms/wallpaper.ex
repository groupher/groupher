defmodule GroupherServer.CMS.Wallpaper do
  @moduledoc """
  Public product facade for Wallpaper settings, upload, publish, and retention.

  One save owns one theme. Internal owner modules validate upload inputs,
  coordinate Assets Hub, commit immutable Snapshots, expose active projections,
  and clean expired lifecycle data.

  Business position:

      GraphQL mutation / query / job
        -> CMS.Wallpaper facade
        -> Reader / Upload / Publisher / Retention
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Community
  alias CMS.Wallpaper.{Publisher, Reader, Retention, Upload}

  @doc "Returns the cross-language Wallpaper profile matrix."
  def profile_specs, do: Upload.profile_specs()

  @doc "Reports whether an Assets Hub Batch has already produced a Snapshot."
  def batch_published?(batch_ref), do: Reader.batch_published?(batch_ref)

  @doc "Returns the Assets Hub targets for one theme and internal Snapshot ref."
  def required_image_targets(theme, snapshot_ref),
    do: Upload.required_image_targets(theme, snapshot_ref)

  @doc "Creates the temporary Assets Hub Batch for the current theme only."
  def prepare_upload(%Community{} = community, input, %User{} = user),
    do: Upload.prepare(community, input, user)

  @doc "Returns the published image tree used by ordinary pages."
  def wallpaper(community_id), do: Reader.wallpaper(community_id)

  @doc "Returns complete settings for the editor, using Backend defaults when absent."
  def wallpaper_settings(community_id), do: Reader.wallpaper_settings(community_id)

  @doc "Returns retained history for the selected theme."
  def wallpaper_history(community_id, theme), do: Reader.wallpaper_history(community_id, theme)

  @doc "Publishes one current-theme Snapshot, or a canonical NONE Snapshot."
  def publish(%Community{} = community, input, %User{} = user),
    do: Publisher.publish(community, input, user)

  @doc "Restores one retained public Snapshot ID for its original theme."
  def restore_snapshot(%Community{} = community, input, %User{} = user),
    do: Publisher.restore_snapshot(community, input, user)

  @doc "Deletes expired receipts, Snapshots, and unreferenced generated assets."
  def reconcile_lifecycle, do: Retention.reconcile_lifecycle()
end
