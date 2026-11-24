defmodule GroupherServerWeb.Schema.Helper.Objects do
  @moduledoc """
  Reusable Absinthe object macros for paged and cross-thread CMS results.

  Business position:

      Client
        -> Absinthe schema / Objects
        -> resolver or domain context
        -> GraphQL response
  """
  alias GroupherServer.CMS

  @threads CMS.artiment_config_threads()

  @doc "Declares the resource-owned ArticleLite and Page contracts for every Article thread."
  defmacro article_page_objects do
    Enum.map(@threads, fn thread ->
      status_field =
        if thread == :post do
          quote do
          end
        else
          quote do
            @desc "Workflow status of the article."
            field(:status, :article_status_enum)
          end
        end

      quote do
        object unquote(:"#{thread}_lite") do
          @desc "Stable article ID, shared across community listings."
          field(:id, non_null(:id))
          @desc "Content thread this article belongs to."
          field(:thread, non_null(unquote(:"#{thread}_thread")))
          @desc "Article ID within the listed community and thread."
          field(:inner_id, non_null(:id))
          @desc "Published article title."
          field(:title, non_null(:string))
          @desc "Short preview of the article body."
          field(:digest, :string)
          @desc "User who authored the article."
          field(:author, non_null(:common_user))
          @desc "Community for this listing."
          field(:community, non_null(:community))
          @desc "Tags for this article in the listed community."
          field(:community_tags, non_null(list_of(non_null(:community_tag))))
          @desc "Timestamp used to order the article by activity."
          field(:active_at, :datetime)
          @desc "Publication timestamp shown in this listing."
          field(:inserted_at, non_null(:datetime))
          @desc "Category assigned to the article, when applicable."
          field(:cat, :article_cat_enum)
          unquote(status_field)
          @desc "Whether the article is pinned in this community."
          field(:is_pinned, non_null(:boolean))
        end

        object unquote(:"#{thread}_page") do
          @desc "Article summaries in the requested page."
          field(:entries, non_null(list_of(non_null(unquote(:"#{thread}_lite")))))
          @desc "Pinned article summaries returned separately from the page entries."
          field(:pinned_entries, non_null(list_of(non_null(unquote(:"#{thread}_lite")))))
          @desc "Pagination metadata for the requested page."
          field(:page_info, non_null(:page_info))
        end
      end
    end)
  end
end
