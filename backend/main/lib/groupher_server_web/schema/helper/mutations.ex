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

  @doc """
  add basic mutation reactions to article
  """
  defmacro article_react_mutations(thread, reactions) do
    reactions
    |> Enum.map(
      &quote do
        unquote(:"article_#{&1}_mutation")(unquote(thread))
      end
    )
  end

  defmacro article_cover_args do
    quote do
      arg(:cover_url, :string)
      arg(:cover_url_dark, :string)
      arg(:cover_edit_info, :cover_edit_info_input)
      arg(:cover_asset_id, :id)
      arg(:cover_asset, :community_asset_input)
      arg(:cover_asset_dark_id, :id)
      arg(:cover_asset_dark, :community_asset_input)
    end
  end

  defmacro article_asset_args do
    quote do
      arg(:asset_refs, list_of(:article_document_asset_ref_input))
    end
  end

  @doc """
  upvote mutation for article

  include:
  -----
  upvote_[thread]
  undo_upvote_[thread]
  """
  defmacro article_upvote_mutation(thread) do
    quote do
      @desc unquote("upvote to #{thread}")
      field unquote(:"upvote_#{thread}"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.upvote_article/3)
      end

      @desc unquote("undo upvote to #{thread}")
      field unquote(:"undo_upvote_#{thread}"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_upvote_article/3)
      end
    end
  end

  @doc """
  pin mutation for article

  include:
  -----
  pin_[thread]
  unto_pin_[thread]
  """
  defmacro article_pin_mutation(thread) do
    quote do
      @desc unquote("pin to #{thread}")
      field unquote(:"pin_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.pin"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.pin_article/3)
      end

      @desc unquote("undo pin to #{thread}")
      field unquote(:"undo_pin_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_pin"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_pin_article/3)
      end
    end
  end

  @doc """
  emotion mutation for article

  include:
  -----
  emotion_to_[thread]
  unto_emotion_to_[thread]
  """
  defmacro article_emotion_mutation(thread) do
    quote do
      @desc unquote("emotion to #{thread}")
      field unquote(:"emotion_to_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))
        arg(:emotion, non_null(:article_emotion))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.emotion_to_article/3)
      end

      @desc unquote("undo emotion to #{thread}")
      field unquote(:"undo_emotion_to_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))
        arg(:emotion, non_null(:article_emotion))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_emotion_to_article/3)
      end
    end
  end

  @doc """
  report mutation for article

  include:
  -----
  report_[thread]
  undo_report_[thread]
  """
  defmacro article_report_mutation(thread) do
    quote do
      @desc unquote("report a #{thread}")
      field unquote(:"report_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))
        arg(:reason, non_null(:string))
        arg(:attr, :string, default_value: "")

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.report_article/3)
      end

      @desc unquote("undo report a #{thread}")
      field unquote(:"undo_report_#{thread}"), unquote(thread) do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)
        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_report_article/3)
      end
    end
  end

  @doc """
  sink mutation for article

  include:
  -----
  sink_[thread]
  undo_sink_[thread]
  """
  defmacro article_sink_mutation(thread) do
    quote do
      @desc unquote("sink a #{thread}")
      field unquote(:"sink_#{thread}"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.sink"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.sink_article/3)
      end

      @desc unquote("undo sink to #{thread}")
      field unquote(:"undo_sink_#{thread}"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_sink"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_sink_article/3)
      end
    end
  end

  @doc """
  lock comment of a article

  include:
  -----
  lock_[thread]_comment
  undo_lock_[thread]_comment
  """
  defmacro article_lock_comment_mutation(thread) do
    quote do
      @desc unquote("lock comment of a #{thread}")
      field unquote(:"lock_#{thread}_comment"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.lock_comment"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.lock_article_comments/3)
      end

      @desc unquote("undo lock to a #{thread}")
      field unquote(:"undo_lock_#{thread}_comment"), :article do
        arg(:article, non_null(:article_path_input))

        middleware(M.Authorize, :login)

        middleware(M.Passport,
          action: unquote("#{to_string(thread)}.undo_lock_comment"),
          thread: unquote(thread)
        )

        middleware(M.FrontDesk, {:article, thread: unquote(thread)})

        resolve(&R.CMS.undo_lock_article_comments/3)
      end
    end
  end
end
