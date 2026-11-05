defmodule GroupherServer.CMS.Articles.ActivityTime do
  @moduledoc """
  One UTC expression for Doc activity display, ordering and cursor values.

      Article + selected main body -> effective activity SQL -> display / sort / cursor
  """
  import Ecto.Query

  @doc false
  defmacro sql(article, state, public) do
    quote do
      type(
        fragment(
          "COALESCE(GREATEST(?, ?), ?, ?)",
          unquote(article).active_at,
          unquote(state).active_at,
          unquote(public).published_at,
          unquote(article).inserted_at
        ),
        :utc_datetime
      )
    end
  end

  @doc "Combines stable discussion activity and the selected body's activity."
  def effective_doc(_opts \\ []) do
    dynamic(
      [article, stable_doc_state: state, stable_public: public],
      sql(article, state, public)
    )
  end
end
