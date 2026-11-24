defmodule GroupherServerWeb.Schema.Helper.Mutations do
  @moduledoc """
  Reusable mutation macros for artiment reactions and related CMS operations.

  can not define private macros, see:
  https://github.com/elixir-lang/elixir/issues/3887

  Thread modules use `article_react_mutations/2` to expand their supported
  reactions. Trash lifecycle mutations are intentionally defined once in the
  cross-entity CMS operation schema instead of being generated per thread.

  Business position:

      Client
        -> Absinthe schema / Mutations
        -> resolver or domain context
        -> GraphQL response
  """
  alias GroupherServerWeb.Middleware, as: M
  alias GroupherServerWeb.Resolvers, as: R

  @doc "Expands the selected mutation pairs for one article thread."
  defmacro article_react_mutations(thread, reactions) do
    reactions
    |> Enum.map(
      &quote do
        unquote(:"article_#{&1}_mutation")(unquote(thread))
      end
    )
  end

  @doc "Declares light and dark cover URLs, asset references and cover editing options."
  defmacro article_cover_args do
    quote do
      @desc "URL of the default article cover."
      arg(:cover_url, :string)
      @desc "URL of the dark-mode article cover."
      arg(:cover_url_dark, :string)
      @desc "Display adjustments for the article cover."
      arg(:cover_edit_info, :cover_edit_info_input)
      @desc "Asset ID of the default cover."
      arg(:cover_asset_id, :id)
      @desc "Asset details for the default cover."
      arg(:cover_asset, :community_asset_input)
      @desc "Asset ID of the dark-mode cover."
      arg(:cover_asset_dark_id, :id)
      @desc "Asset details for the dark-mode cover."
      arg(:cover_asset_dark, :community_asset_input)
    end
  end

  @doc "Declares the asset references associated with the article."
  defmacro article_asset_args do
    quote do
      @desc "Assets referenced by this article."
      arg(:asset_refs, list_of(:article_asset_ref_input))
    end
  end

  @doc "Declares attribution, source link, subtitle and template arguments for thread content."
  defmacro article_thread_content_args do
    quote do
      @desc "Copyright attribution for the article."
      arg(:copy_right, :string)
      @desc "Source link for the article."
      arg(:link_addr, :string)
      @desc "Secondary title for the article."
      arg(:subtitle, :string)
      @desc "Key identifying the article template."
      arg(:template_key, :string)
    end
  end

  @doc "Declares mutations to add or remove the viewer's upvote."
  defmacro article_upvote_mutation(thread) do
    quote do
      @desc unquote("Add your upvote to this #{thread}.")
      field unquote(:"upvote_#{thread}"), :article_reaction_result do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Interactions.upvote_article/3)
      end

      @desc unquote("Remove your upvote from this #{thread}.")
      field unquote(:"undo_upvote_#{thread}"), :article_reaction_result do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Interactions.undo_upvote_article/3)
      end
    end
  end

  @doc "Declares mutations to pin or unpin an article in its community."
  defmacro article_pin_mutation(thread) do
    quote do
      @desc unquote("Pin this #{thread} in its community.")
      field unquote(:"pin_#{thread}"), unquote(thread) do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.pin"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Articles.pin_article/3)
      end

      @desc unquote("Unpin this #{thread} in its community.")
      field unquote(:"undo_pin_#{thread}"), unquote(thread) do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_pin"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Articles.undo_pin_article/3)
      end
    end
  end

  @doc "Declares mutations to add or remove the viewer's selected emotion."
  defmacro article_emotion_mutation(thread) do
    quote do
      @desc unquote("Add the selected emotion to this #{thread}.")
      field unquote(:"emotion_to_#{thread}"), :article_reaction_result do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Emotion to add or remove."
        arg(:emotion, non_null(:article_emotion))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Interactions.emotion_to_article/3)
      end

      @desc unquote("Remove your selected emotion from this #{thread}.")
      field unquote(:"undo_emotion_to_#{thread}"), :article_reaction_result do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Emotion to add or remove."
        arg(:emotion, non_null(:article_emotion))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Interactions.undo_emotion_to_article/3)
      end
    end
  end

  @doc "Declares mutations to apply or clear the article's sunk state."
  defmacro article_sink_mutation(thread) do
    quote do
      @desc unquote("Mark this #{thread} as sunk.")
      field unquote(:"sink_#{thread}"), :article do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.sink"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Articles.sink_article/3)
      end

      @desc unquote("Clear the sunk state of this #{thread}.")
      field unquote(:"undo_sink_#{thread}"), :article do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_sink"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Articles.undo_sink_article/3)
      end
    end
  end

  @doc "Declares mutations to lock or reopen an article's comments."
  defmacro article_lock_comment_mutation(thread) do
    quote do
      @desc unquote("Lock comments on this #{thread}.")
      field unquote(:"lock_#{thread}_comment"), :article do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.lock_comment"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Comments.lock_article_comments/3)
      end

      @desc unquote("Reopen comments on this #{thread}.")
      field unquote(:"undo_lock_#{thread}_comment"), :article do
        @desc "Community, thread and local ID of the article."
        arg(:article, non_null(:article_path_input))
        @desc "Client command ID; reuse it when retrying the same write."
        arg(:command_id, non_null(:id))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_lock_comment"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.Comments.undo_lock_article_comments/3)
      end
    end
  end
end
