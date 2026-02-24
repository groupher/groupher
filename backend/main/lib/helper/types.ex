defmodule Helper.Types do
  @moduledoc """
  custom @types
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Blog, Changelog, Doc, Post}

  @type error_reason :: atom()
  @type error_meta :: term()
  @type error :: error_reason() | {error_reason(), error_meta()}

  @typedoc """
  general response conventions
  """

  @type done :: {:ok, term()} | {:error, error()}

  @type ok(t) :: {:ok, t}
  @type err(e) :: {:error, e}

  @type result(t, e) :: ok(t) | err(e)
  @type domain_res(t) :: result(t, error())

  @typedoc """
  Type GraphQL flavor the error format
  """
  @type gq_error ::
          {:error, [message: String.t(), code: non_neg_integer()]} | {:error, Ecto.Changeset.t()}
  @type gq_result(t) :: {:ok, t} | gq_error()

  @type id :: non_neg_integer() | String.t()

  @type article_thread :: :post | :blog | :changelog | :doc

  @type paged_filter :: %{
          page: integer(),
          size: integer(),
          sort: :desc_inserted | :asc_inserted
        }

  @type paged_users :: %{
          entries: [User.t()],
          page_number: integer(),
          page_size: integer(),
          total_count: integer(),
          total_pages: integer()
        }

  @type paged_data :: %{
          entries: [map()],
          page_number: integer(),
          page_size: integer(),
          total_count: integer(),
          total_pages: integer()
        }

  @type article ::
          Post.t()
          | Blog.t()
          | Doc.t()
          | Changelog.t()

  @type article_common :: %{
          id: integer(),
          thread: atom(),
          title: String.t(),
          upvotes_count: integer(),
          meta: %{
            upvoted_user_ids: [integer()],
            collected_user_ids: [integer()],
            viewed_user_ids: [integer()],
            reported_user_ids: [integer()]
          }
        }

  @type paged_article_common :: %{
          entries: [article_common],
          page_number: integer(),
          page_size: integer(),
          total_count: integer(),
          total_pages: integer()
        }

  @type article_info :: %{
          thread: article_thread,
          article: %{
            title: String.t()
          },
          author: %{
            id: integer(),
            login: String.t(),
            nickname: String.t()
          }
        }

  @typedoc """
  editor.js's header tool data format
  """
  @type editor_header :: %{
          required(:text) => String.t(),
          required(:level) => String.t(),
          eyebrowTitle: String.t(),
          footerTitle: String.t()
        }

  @typep editor_quote_mode :: :short | :long
  @typedoc """
  editor.js's quote tool data format
  """
  @type editor_quote :: %{
          required(:text) => String.t(),
          required(:mode) => editor_quote_mode,
          caption: String.t()
        }

  @typedoc """
  valid editor.js's list item indent
  """
  @type editor_list_indent :: 0 | 1 | 2 | 3

  @typedoc """
  valid editor.js's list item label type
  """
  @type editor_list_label_type :: :default | :red | :green | :warn

  @typedoc """
  editor.js's list item for order_list | unordered_list | checklist
  """
  @type editor_list_item :: %{
          required(:hideLabel) => String.t(),
          required(:indent) => editor_list_indent,
          required(:label) => String.t(),
          required(:labelType) => editor_list_label_type,
          required(:text) => String.t(),
          prefixIndex: String.t()
        }

  @typedoc """
  editor.js's Table align type
  """
  @type editor_table_align :: :center | :left | :right

  @typedoc """
  editor.js's Table td type
  """
  @type editor_table_cell :: %{
          required(:text) => String.t(),
          required(:align) => editor_table_align,
          isStripe: boolean(),
          isHeader: boolean()
        }

  # @typep editor_image_mode :: :single | :jiugongge | :gallery

  @typedoc """
  editor.js's image item
  """
  @type editor_image_item :: %{
          required(:src) => String.t(),
          caption: String.t(),
          index: integer(),
          width: String.t(),
          height: String.t()
        }

  @typedoc """
  editor.js's people item
  """
  @type editor_people_item :: %{
          required(:id) => String.t(),
          required(:avatar) => String.t(),
          required(:title) => String.t(),
          required(:bio) => String.t(),
          required(:desc) => String.t()
        }

  @typedoc """
  editor.js's social item for any block
  """
  @type editor_social_item :: %{
          required(:name) => String.t(),
          required(:link) => String.t()
        }
  @typedoc """
  html fragment
  """
  @type html :: String.t()

  @type cite_info :: %{
          id: integer(),
          thread: article_thread,
          title: String.t(),
          inserted_at: String.t(),
          block_linker: [String.t()],
          comment_id: integer() | nil,
          user: %{
            login: String.t(),
            avatar: String.t(),
            nickname: String.t()
          }
        }
end
