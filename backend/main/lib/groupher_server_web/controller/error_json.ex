defmodule GroupherServerWeb.ErrorJSON do
  @moduledoc """
  JSON error renderer for API and GraphQL HTTP responses.

  It converts Phoenix error templates into a normalized `%{errors: %{detail: ...}}`
  payload consumed by API clients.
  """
  # If you want to customize a particular status code,
  # you may add your own clauses, such as:
  #
  # def render("500.json", _assigns) do
  #   %{errors: %{detail: "Internal Server Error"}}
  # end

  # By default, Phoenix returns the status message from
  # the template name. For example, "404.json" becomes
  # "Not Found".
  @doc """
  Renders a JSON error payload from a template name.
  """
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
