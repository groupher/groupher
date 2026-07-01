defmodule GroupherServer.CMS.Search do
  @moduledoc """
  CMS search facade.
  """

  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  alias __MODULE__.{Article, Community}

  @spec community(String.t()) :: T.domain_res(T.paged_data())
  def community(title), do: Community.search(title)

  @spec community(String.t(), User.t()) :: T.domain_res(T.paged_data())
  def community(title, %User{} = user), do: Community.search(title, user)

  @spec community(String.t(), String.t()) :: T.domain_res(T.paged_data())
  def community(title, category) when is_binary(category), do: Community.search(title, category)

  @spec community(String.t(), String.t(), User.t()) :: T.domain_res(T.paged_data())
  def community(title, category, %User{} = user) when is_binary(category) do
    Community.search(title, category, user)
  end

  @spec article(T.thread(), String.t()) :: T.domain_res(T.paged_data())
  def article(thread, title) when is_binary(title), do: Article.search(thread, title)
end
