defmodule GroupherServer.CMS.Passport.LegacyVocabulary do
  @moduledoc """
  Frozen grant vocabulary for the explicit offline legacy conversion report.

  This module is not an authorization registry or a runtime permission contract.
  Runtime authorization uses CMS.Passport.Catalog exclusively.

      offline legacy report -> frozen vocabulary -> conversion classification
  """

  alias GroupherServer.CMS
  alias CMS.Artiment.Config
  @contexts ["cms"]

  @doc """
  Returns supported passport contexts.
  """
  def contexts, do: @contexts

  @doc """
  Returns configured article thread slugs.
  """
  def threads, do: Config.threads() |> Enum.map(&to_string/1)

  @doc """
  Returns valid system-level grants.

  Example passport JSON:

      %{
        "global" => %{
          "community.create" => true,
          "god" => true
        }
      }
  """
  def global_grants do
    threaded_grants(["community.mirror", "community.unmirror", "community.move"]) ++
      [
        "god",
        "system_notification.publish",
        "stamp_passport",
        "community.create",
        "community.update",
        "community.request_destroy",
        "community.application.review",
        "community.application.approve",
        "community.application.reject",
        "community.application.retry_creation",
        "community.application.retry_setup",
        "review.platform.read",
        "review.platform.decide",
        "review.platform.configure",
        "category.create",
        "category.update",
        "category.delete",
        "category.set",
        "category.unset"
      ]
  end

  @doc """
  Returns valid community CMS grants.

  Example passport JSON:

      %{
        "<community_slug>" => %{
          "cms" => %{
            "post.pin" => true,
            "post.pin" => true
          }
        }
      }
  """
  def cms_grants do
    threaded_grants([
      "trash",
      "restore",
      "permanent_delete",
      "pin",
      "undo_pin",
      "sink",
      "undo_sink",
      "lock_comment",
      "undo_lock_comment",
      "community_tag.create",
      "community_tag.update",
      "community_tag.delete",
      "community_tag.set",
      "community_tag.unset"
    ]) ++
      [
        "thread.create",
        "thread.set",
        "thread.unset",
        "asset.upload",
        "doc.history.read",
        "doc.import",
        "doc.queue.approve",
        "doc.queue.configure",
        "doc.queue.preview",
        "doc.queue.publish",
        "doc.queue.write",
        "community.update",
        "article.insights.read",
        "review.read",
        "review.decide",
        "review.configure",
        "ticket.create",
        "ticket.link_source",
        "ticket.update",
        "ticket.transition",
        "ticket.assign",
        "ticket.manage_case",
        "ticket.manage_visibility",
        "ticket.read_internal",
        "doc.edit",
        "post.set_category"
      ]
  end

  defp threaded_grants(suffixes) do
    Enum.flat_map(suffixes, fn suffix ->
      Enum.map(threads(), &"#{&1}.#{suffix}")
    end)
  end
end
