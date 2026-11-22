defmodule GroupherServer.CMS.Articles.ActivityTime do
  @moduledoc """
  One UTC expression for Doc activity display, ordering and cursor values.

      Article + selected public body -> effective activity SQL -> display / sort / cursor
  """
  import Ecto.Query

  @doc false
  defmacro sql(article, public) do
    quote do
      type(
        fragment(
          "CASE WHEN ? THEN COALESCE(?, ?) ELSE COALESCE(?, ?, ?) END",
          unquote(article).is_sunk,
          unquote(article).active_at,
          unquote(article).inserted_at,
          unquote(article).active_at,
          unquote(public).published_at,
          unquote(article).inserted_at
        ),
        :utc_datetime
      )
    end
  end

  @doc "Uses Article activity with publication and creation time fallbacks."
  def effective_doc(_opts \\ []) do
    dynamic(
      [article, stable_public: public],
      sql(article, public)
    )
  end
end
