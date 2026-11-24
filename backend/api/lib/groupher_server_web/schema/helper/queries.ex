defmodule GroupherServerWeb.Schema.Helper.Queries do
  @moduledoc """
  Reusable Absinthe query macros for thread lists, entries, and viewer state.

  Business position:

      Client
        -> Absinthe schema / Queries
        -> resolver or domain context
        -> GraphQL response
  """
  import Helper.Utils, only: [plural: 1, past_verb: 1]

  alias GroupherServer.CMS
  alias GroupherServerWeb.Middleware, as: M
  alias GroupherServerWeb.Resolvers, as: R

  @threads CMS.artiment_config_threads()

  @doc "Declares one paged publication query per thread for a user identified by login."
  defmacro published_article_queries do
    @threads
    |> Enum.map(fn thread ->
      quote do
        @desc unquote("List #{plural(thread)} published by the user with the given login.")
        field unquote(:"paged_published_#{plural(thread)}"),
              unquote(:"#{thread}_page") do
          @desc "Login of the author whose publications to list."
          arg(:login, non_null(:string))
          @desc "Filters and ordering for the article list."
          arg(:filter, :article_page_filter)
          @desc "Pagination parameters for this list."
          arg(:pagi, :pagi_input)
          @desc "Article thread selected by this query."
          arg(:thread, unquote(:"#{thread}_thread"), default_value: unquote(thread))

          middleware(M.FrontDesk, :user)
          resolve(&R.Accounts.Profiles.paged_published_articles/3)
        end
      end
    end)
  end

  @doc "Declares a single-article lookup by community, thread and local ID for each thread."
  defmacro article_queries do
    @threads
    |> Enum.map(fn thread ->
      quote do
        @desc unquote("Read a #{thread} by its community, thread and local ID.")
        field unquote(thread), non_null(unquote(thread)) do
          @desc "Community, thread and local ID of the article."
          arg(:article, non_null(:article_path_input))

          resolve(fn root, args, info ->
            R.CMS.Articles.read_article(root, args, info, thread: unquote(thread))
          end)
        end
      end
    end)
  end

  @doc "Declares a paged query for users who performed the given article reaction."
  defmacro article_reacted_users_query(action, resolver) do
    quote do
      @desc unquote("List users who have #{past_verb(action)} the article.")
      field unquote(:"#{past_verb(action)}_users"), :user_page do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Pagination parameters for this list."
        arg(:pagi, :pagi_input)

        middleware(M.FrontDesk, :article)

        resolve(unquote(resolver))
      end
    end
  end
end
