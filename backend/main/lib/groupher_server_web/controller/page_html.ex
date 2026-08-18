defmodule GroupherServerWeb.PageHTML do
  @moduledoc """
  HTML view module for page controller templates.

  It exposes HEEx templates used by `GroupherServerWeb.PageController`.

  Business position:

      HTTP request
        -> Phoenix router
        -> PageHTML
        -> HTML/JSON response
  """
  use GroupherServerWeb, :html

  embed_templates("page_html/*")
end
