defmodule GroupherServer.CMS.Seeds.Config do
  @moduledoc false

  @tag_threads [:post, :changelog, :kanban, :doc, :about]
  @content_threads [:post, :changelog, :doc]
  @kanban_states [:backlog, :todo, :wip, :done, :reject]

  @tag_count_range {10, 20}
  @group_count_range {2, 3}

  @article_count_per_thread 23
  @comment_count_per_article 23

  @article_upvotes_range {10, 20}
  @comment_upvotes_range {5, 10}
  @comment_replies_range {1, 1}

  def tag_threads, do: @tag_threads
  def content_threads, do: @content_threads
  def kanban_states, do: @kanban_states

  def tag_count_range, do: @tag_count_range
  def group_count_range, do: @group_count_range

  def article_count_per_thread, do: @article_count_per_thread
  def comment_count_per_article, do: @comment_count_per_article

  def article_upvotes_range, do: @article_upvotes_range
  def comment_upvotes_range, do: @comment_upvotes_range
  def comment_replies_range, do: @comment_replies_range
end
