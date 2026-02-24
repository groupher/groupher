defmodule Helper.Scheduler do
  @moduledoc """
  cron-like job scheduler
  """
  use Quantum.Scheduler, otp_app: :groupher_server

  # import Config
  import Helper.Utils, only: [get_config: 2, done: 1]

  alias GroupherServer.CMS
  alias Helper.Plausible

  alias CMS.Events

  @article_threads get_config(:article, :threads)

  @doc """
  clear all the cache in Cachex
  just in case the cache system broken
  """
  def clear_all_cache do
    # Cache.clear_all()
  end

  @doc """
  archive articles and comments based on config
  """
  def archive_artiments() do
    Enum.map(@article_threads, &CMS.Articles.archive(&1))
    |> done
  end

  def archive_comments() do
    CMS.Comments.archive_comments()
  end

  def articles_audition() do
    audit_articles(:post)
    audit_articles(:blog)
  end

  def comments_audition() do
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

  def gather_online_status() do
    with true <- System.get_env("MIX_ENV") != "test" do
      Plausible.realtime_visitors()
    end
  end
end
