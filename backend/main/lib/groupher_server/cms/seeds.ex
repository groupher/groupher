defmodule GroupherServer.CMS.Seeds do
  @moduledoc """
  CMS seeds for database initialization.
  Should be called ONLY in new database, like migration.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Seeds
        -> Repo / external boundary
  """
  alias GroupherServer.CMS
  alias Helper.T

  alias CMS.Model.{Comment, Community}

  alias __MODULE__.{Articles, CleanUp, Comments, Communities, FullCommunity, LiteHome}

  # Community seeds

  @spec communities(atom()) :: T.domain_res(:ok)
  @doc "Runs `communities` through the public `Seeds` boundary."
  def communities(type), do: Communities.communities(type)

  @spec community(atom()) :: T.domain_res(Community.t())
  @doc "Runs `community` through the public `Seeds` boundary."
  def community(slug), do: Communities.mock(slug)

  @spec community(atom(), atom()) :: T.domain_res(Community.t())
  def community(slug, type), do: Communities.mock(slug, type)

  @spec set_category([atom() | String.t()], atom() | String.t()) :: T.domain_res(:ok)
  @doc "Runs `set_category` through the public `Seeds` boundary."
  def set_category(communities_names, cat_name),
    do: Communities.set_category(communities_names, cat_name)

  @spec full_community(String.t() | atom()) :: T.domain_res(Community.t())
  @doc "Runs `full_community` through the public `Seeds` boundary."
  def full_community(slug), do: FullCommunity.mock(slug)

  @spec full_community(String.t() | atom(), keyword()) :: T.domain_res(Community.t())
  def full_community(slug, opts) when is_list(opts), do: FullCommunity.mock(slug, opts)

  @spec delete_full_community(String.t() | atom()) :: T.domain_res(:ok)
  @doc "Removes full community through the `Seeds` boundary."
  def delete_full_community(slug), do: FullCommunity.delete(slug)

  @spec lite_home(keyword()) :: T.domain_res(Community.t())
  @doc "Runs `lite_home` through the public `Seeds` boundary."
  def lite_home(opts \\ []) when is_list(opts), do: LiteHome.seed(opts)

  @spec reset_lite_home(keyword()) :: T.domain_res(Community.t())
  @doc "Runs `reset_lite_home` through the public `Seeds` boundary."
  def reset_lite_home(opts \\ []) when is_list(opts), do: LiteHome.reset_and_seed(opts)

  # Article seeds

  @spec articles(Community.t(), atom()) :: T.domain_res([map()])
  @doc "Runs `articles` through the public `Seeds` boundary."
  def articles(%Community{} = community, thread), do: Articles.mock(community, thread)

  @spec articles(Community.t(), atom(), integer()) :: T.domain_res([map()])
  def articles(%Community{} = community, thread, count),
    do: Articles.mock(community, thread, count)

  # Comment seeds

  @spec comment_replies(Comment.t()) :: T.domain_res(:ok)
  @doc "Runs `comment_replies` through the public `Seeds` boundary."
  def comment_replies(%Comment{} = comment), do: Comments.mock_replies(comment)

  @spec comment_emotions(Comment.t()) :: T.domain_res(:ok)
  @doc "Runs `comment_emotions` through the public `Seeds` boundary."
  def comment_emotions(%Comment{} = comment), do: Comments.mock_emotions(comment)

  # Clean up

  @spec clean_up_community(atom()) :: T.domain_res(Community.t())
  @doc "Runs `clean_up_community` through the public `Seeds` boundary."
  def clean_up_community(slug), do: CleanUp.community(slug)

  @spec clean_up_articles(Community.t(), atom()) :: T.domain_res(:ok)
  @doc "Runs `clean_up_articles` through the public `Seeds` boundary."
  def clean_up_articles(%Community{} = community, type), do: CleanUp.articles(community, type)
end
