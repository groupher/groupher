defmodule GroupherServerWeb.Layouts do
  @moduledoc """
  Shared HTML layout components for Phoenix-rendered pages.

  This module hosts reusable templates that wrap controller views with common UI
  structure such as head, navigation, and container composition.
  """
  use GroupherServerWeb, :html

  embed_templates("layouts/*")
end
