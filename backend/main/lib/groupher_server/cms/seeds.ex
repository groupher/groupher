defmodule GroupherServer.CMS.Seeds do
  @moduledoc """
  CMS seeds for database initialization.
  Should be called ONLY in new database, like migration.
  """
  alias GroupherServer.CMS
  alias Helper.T

  alias CMS.Model.{Comment, Community}

  alias __MODULE__.{Articles, CleanUp, Comments, Communities, FullCommunity}

  # Community seeds

  @spec communities(atom()) :: T.domain_res(:ok)
  def communities(type), do: Communities.communities(type)

  @spec community(atom()) :: T.domain_res(Community.t())
  def community(slug), do: Communities.mock(slug)

  @spec community(atom(), atom()) :: T.domain_res(Community.t())
  def community(slug, type), do: Communities.mock(slug, type)

  @spec set_category([atom() | String.t()], atom() | String.t()) :: T.domain_res(:ok)
  def set_category(communities_names, cat_name),
    do: Communities.set_category(communities_names, cat_name)

  @spec full_community(String.t() | atom()) :: T.domain_res(Community.t())
  def full_community(slug), do: FullCommunity.mock(slug)

  @spec full_community(String.t() | atom(), keyword()) :: T.domain_res(Community.t())
  def full_community(slug, opts) when is_list(opts), do: FullCommunity.mock(slug, opts)

  @spec delete_full_community(String.t() | atom()) :: T.domain_res(:ok)
  def delete_full_community(slug), do: FullCommunity.delete(slug)

  # Article seeds

  @spec articles(Community.t(), atom()) :: T.domain_res([map()])
  def articles(%Community{} = community, thread), do: Articles.mock(community, thread)

  @spec articles(Community.t(), atom(), integer()) :: T.domain_res([map()])
  def articles(%Community{} = community, thread, count),
    do: Articles.mock(community, thread, count)

  # Comment seeds

  @spec comment_replies(Comment.t()) :: T.domain_res(:ok)
  def comment_replies(%Comment{} = comment), do: Comments.mock_replies(comment)

  @spec comment_emotions(Comment.t()) :: T.domain_res(:ok)
  def comment_emotions(%Comment{} = comment), do: Comments.mock_emotions(comment)

  # Clean up

  @spec clean_up_community(atom()) :: T.domain_res(Community.t())
  def clean_up_community(slug), do: CleanUp.community(slug)

  @spec clean_up_articles(Community.t(), atom()) :: T.domain_res(:ok)
  def clean_up_articles(%Community{} = community, type), do: CleanUp.articles(community, type)
end
