defmodule GroupherServerWeb do
  @moduledoc """
  Shared compile-time entrypoint for Phoenix controllers, routers, channels,
  HTML components, and verified routes.

  This can be used in your application as:

      use GroupherServerWeb, :controller
      use GroupherServerWeb, :router
      use GroupherServerWeb, :html

  Each quoted block stays limited to framework setup, imports, aliases, and the
  `Phoenix.VerifiedRoutes` contract. Product and domain behavior belongs in
  normal modules outside this macro boundary.

  Business position:

      Controller / Router / Channel / HTML module
        -> use GroupherServerWeb
        -> Phoenix framework imports + verified routes
        -> Endpoint / Router / rendered response
  """

  def static_paths, do: ~w(assets fonts images favicon.ico robots.txt)

  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:html, :json],
        layouts: [html: GroupherServerWeb.Layouts]

      # use Phoenix.Controller, namespace: GroupherServerWeb
      import Plug.Conn
      # import GroupherServerWeb.Router.Helpers
      use Gettext, backend: GroupherServerWeb.Gettext

      unquote(verified_routes())
    end
  end

  # def view do
  #   quote do
  #     use Phoenix.View,
  #       root: "lib/groupher_server_web/templates",
  #       namespace: GroupherServerWeb

  #     # Import convenience functions from controllers
  #     import Phoenix.Controller, only: [get_flash: 2, view_module: 1]

  #     import GroupherServerWeb.Router.Helpers
  #     import GroupherServerWeb.ErrorHelpers
  #     import GroupherServerWeb.Gettext
  #   end
  # end

  def router do
    quote do
      use Phoenix.Router, helpers: false

      # Import common connection and controller functions to use in pipelines
      import Plug.Conn
      import Phoenix.Controller
      import Phoenix.LiveView.Router
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def html do
    quote do
      use Phoenix.Component

      # Import convenience functions from controllers
      import Phoenix.Controller,
        only: [get_csrf_token: 0, view_module: 1, view_template: 1]

      # Include general helpers for rendering HTML
      unquote(html_helpers())
    end
  end

  defp html_helpers do
    quote do
      # HTML escaping functionality
      import Phoenix.HTML
      # Core UI components and translation
      import GroupherServerWeb.CoreComponents
      use Gettext, backend: GroupherServerWeb.Gettext

      # Routes generation with the ~p sigil
      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: GroupherServerWeb.Endpoint,
        router: GroupherServerWeb.Router,
        statics: GroupherServerWeb.static_paths()
    end
  end

  @doc "Dispatches `use GroupherServerWeb, role` to the matching framework setup macro."
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
