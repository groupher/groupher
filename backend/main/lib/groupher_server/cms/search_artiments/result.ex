defmodule GroupherServer.CMS.SearchArtiments.Result do
  @moduledoc """
  Platform-neutral paged Search Artiments result.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Result
        -> search platform
  """

  alias GroupherServer.CMS.SearchArtiments.Artiment

  @type highlight :: %{
          required(:field) => :title | :plain_text,
          required(:fragments) => [String.t()]
        }
  @type hit :: %{required(:artiment) => Artiment.t(), required(:highlights) => [highlight()]}

  @type t :: %__MODULE__{
          entries: [hit()],
          total_pages: non_neg_integer(),
          total_count: non_neg_integer(),
          page_size: pos_integer(),
          page_number: pos_integer()
        }

  defstruct entries: [], total_pages: 0, total_count: 0, page_size: 20, page_number: 1
end
