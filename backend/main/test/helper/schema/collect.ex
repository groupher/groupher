defmodule GroupherServer.Test.Helper.Schema.Collect do
  @moduledoc "GraphQL documents used by collect tests."

  def m(:create_collect_folder) do
    """
    mutation($title: String!, $desc: String, $private: Boolean) {
          createCollectFolder(title: $title, desc: $desc, private: $private) {
            id
            title
            private
            lastUpdated
          }
        }
    """
  end

  def m(:update_collect_folder) do
    """
    mutation($id: ID!, $title: String, $desc: String, $private: Boolean) {
          updateCollectFolder(
            id: $id
            title: $title
            desc: $desc
            private: $private
          ) {
            id
            title
            desc
            private
            lastUpdated
          }
        }
    """
  end

  def m(:delete_collect_folder) do
    """
    mutation($id: ID!) {
          deleteCollectFolder(id: $id) {
            id
          }
        }
    """
  end

  def m(:add_to_collect) do
    """
    mutation($article: ArticlePathInput!, $folderId: ID!) {
          addToCollect(article: $article, folderId: $folderId) {
            id
            title
            totalCount
            lastUpdated

            meta {
              hasPost
              hasBlog
              postCount
              blogCount
            }
          }
        }
    """
  end

  def m(:remove_from_collect) do
    """
    mutation($article: ArticlePathInput!, $folderId: ID!) {
          removeFromCollect(article: $article, folderId: $folderId) {
            id
            title
            totalCount
            lastUpdated

            meta {
              hasPost
              hasBlog
              postCount
              blogCount
            }
          }
        }
    """
  end

  def q(:paged_collect_folders) do
    """
    query($login: String!, $filter: CollectFoldersFilter!) {
        pagedCollectFolders(login: $login, filter: $filter) {
          entries {
            id
            title
            private
          }
          totalPages
          totalCount
          pageSize
          pageNumber
        }
      }
    """
  end

  def q(:paged_collected_articles) do
    """
    query($folderId: ID!, $filter: CollectedArticlesFilter!) {
          pagedCollectedArticles(folderId: $folderId, filter: $filter) {
            entries {
              innerId
              title
            }
          totalPages
          totalCount
          pageSize
          pageNumber
        }
      }
    """
  end
end
