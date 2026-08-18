defmodule Helper.Scheduler do
  @moduledoc """
  Quantum scheduler entrypoints for periodic compatibility and maintenance work.

  The scheduler invokes domain facades; it does not own article, comment, Trash,
  or audit state. New durable asynchronous work should normally use Oban jobs.

  Business position:

      Domain or web caller
        -> Scheduler
        -> normalized value / infrastructure
  """
  use Quantum, otp_app: :groupher_server

  # import Config
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS

  alias GroupherServer.CMS.Events

  @threads GroupherServer.CMS.Artiment.Config.threads()

  @doc """
  Compatibility hook reserved for a full Cachex clear.

  The current implementation intentionally performs no operation.
  """
  def clear_all_cache do
    # Cache.clear_all()
  end

  @doc """
  Archives eligible artiments for every configured thread.
  """
  def archive_artiments do
    Enum.map(@threads, &CMS.Articles.archive(&1))
    |> done
  end

  @doc "Archives comments that meet the CMS retention policy."
  def archive_comments do
    CMS.Comments.archive_comments()
  end

  @doc "Permanently deletes Trash actions whose retention window has elapsed."
  def purge_expired_trash do
    CMS.Trash.purge_due()
  end

  @doc "Emits audit events for failed Post and Blog moderation records."
  def articles_audition do
    audit_articles(:post)
    audit_articles(:blog)
  end

  @doc "Emits audit events for the current page of failed comment moderation records."
  def comments_audition do
    with {:ok, paged_comments} <- CMS.Comments.paged_audit_failed_comments(%{page: 1, size: 30}) do
      Enum.map(paged_comments.entries, fn comment ->
        Events.emit(:audition, %{artiment: comment})
      end)
      |> done
    end
  end

  defp audit_articles(thread) do
    with {:ok, paged_articles} <-
           CMS.Articles.paged_audit_failed(thread, %{page: 1, size: 30}) do
      Enum.map(paged_articles.entries, fn article ->
        Events.emit(:audition, %{artiment: article})
        # the free audition service's QPS is limit to 2
        Process.sleep(500)
      end)
      |> done
    end
  end
end
