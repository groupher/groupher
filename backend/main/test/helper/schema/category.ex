defmodule GroupherServer.Test.Helper.Schema.Category do
  @moduledoc "GraphQL documents used by category tests."

  def m(:create_category) do
    """
    mutation($community: String!, $title: String!, $slug: String!) {
          createCategory(community: $community, title: $title, slug: $slug) {
            id
            title
            author {
              login
              nickname
              avatar
            }
          }
        }
    """
  end

  def m(:delete_category) do
    """
    mutation($community: String!, $id: ID!) {
          deleteCategory(community: $community, id: $id) {
            id
          }
        }
    """
  end

  def m(:update_category) do
    """
    mutation($community: String!, $id: ID!, $title: String!) {
          updateCategory(community: $community, id: $id, title: $title) {
            id
            title
          }
        }
    """
  end

  def m(:set_category) do
    """
    mutation($categoryId: ID! $community: String!) {
          setCategory(categoryId: $categoryId, community: $community) {
            slug
            title

            categories {
              id
              title
            }
          }
        }
    """
  end

  def m(:unset_category) do
    """
    mutation($categoryId: ID! $community: String!) {
          unsetCategory(categoryId: $categoryId, community: $community) {
            slug
            title
          }
        }
    """
  end
end
