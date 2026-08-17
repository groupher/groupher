defmodule GroupherServer.CMS.Seeds.Config do
  @moduledoc """
  Static configuration used by CMS seed flows.

  Keep seed-only constants here so demo data choices do not leak into runtime
  CMS defaults.

  Business position:

      Seed task
        -> Config
        -> CMS context
        -> Repo
  """

  @tag_threads [:post, :changelog, :kanban, :doc, :about]
  @content_threads [:post, :changelog, :doc]
  @kanban_states [:backlog, :todo, :wip, :done, :reject]

  @tag_count_range {10, 20}
  @group_count_range {2, 3}

  @article_count_per_thread 23
  @comment_count_range {8, 30}

  @article_upvotes_range {10, 20}
  @comment_upvotes_range {5, 10}
  @comment_replies_range {0, 3}

  @doc "Returns the threads that receive seeded tag groups."
  def tag_threads, do: @tag_threads

  @doc "Returns the threads that receive seeded article content."
  def content_threads, do: @content_threads

  @doc "Returns the kanban workflow states used by seeded posts."
  def kanban_states, do: @kanban_states

  @doc "Returns the random count range for seeded tags per thread."
  def tag_count_range, do: @tag_count_range

  @doc "Returns the random count range for seeded tag groups."
  def group_count_range, do: @group_count_range

  @doc "Returns the default seeded article count per content thread."
  def article_count_per_thread, do: @article_count_per_thread

  @doc "Returns the lower bound of the seeded comment count range."
  def comment_count_per_article, do: elem(@comment_count_range, 0)

  @doc "Returns the random count range for seeded comments per article."
  def comment_count_range, do: @comment_count_range

  @doc "Returns the random upvote range for seeded articles."
  def article_upvotes_range, do: @article_upvotes_range

  @doc "Returns the random upvote range for seeded comments."
  def comment_upvotes_range, do: @comment_upvotes_range

  @doc "Returns the random reply count range for seeded comments."
  def comment_replies_range, do: @comment_replies_range
end
