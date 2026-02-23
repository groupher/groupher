defmodule GroupherServer.CMS.Hooks do
  @moduledoc """
  Facade and main entry point for CMS hook-related functionality.

  This module provides a unified interface for working with CMS hooks so that
  other parts of the system do not need to know about individual hook
  implementations or where they are defined. By routing hook operations
  through this module, callers can:

    * trigger hooks associated with CMS events
    * keep hook-related logic encapsulated behind a stable API
    * centralize cross-cutting behavior that should run when CMS events occur

  In typical usage, higher-level CMS contexts or services call functions
  exposed by this module instead of invoking hook modules directly. This helps
  maintain a clear boundary for hook behavior and makes it easier to evolve
  or reconfigure hooks without touching the rest of the codebase.
  """
end
