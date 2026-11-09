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
            field(:status, :article_status_enum)
          end
        end

      quote do
        object unquote(:"#{thread}_lite") do
          field(:id, non_null(:id))
          field(:thread, non_null(unquote(:"#{thread}_thread")))
          field(:inner_id, non_null(:id))
          field(:title, non_null(:string))
          field(:digest, :string)
          field(:author, non_null(:common_user))
          field(:community, non_null(:community))
          field(:community_tags, non_null(list_of(non_null(:community_tag))))
          field(:active_at, :datetime)
          field(:inserted_at, non_null(:datetime))
          field(:cat, :article_cat_enum)
          unquote(status_field)
          field(:is_pinned, non_null(:boolean))
        end

        object unquote(:"#{thread}_page") do
          field(:entries, non_null(list_of(non_null(unquote(:"#{thread}_lite")))))
          field(:pinned_entries, non_null(list_of(non_null(unquote(:"#{thread}_lite")))))
          field(:page_info, non_null(:page_info))
        end
      end
    end)
  end
end
