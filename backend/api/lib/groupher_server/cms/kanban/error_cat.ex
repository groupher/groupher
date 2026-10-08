defmodule GroupherServer.CMS.Kanban.ErrorCat do
  @moduledoc """
  Community-local Kanban errors.

  Kanban membership failures belong to the Kanban boundary rather than the
  generic Article catalog because the Article may still exist in the
  Community while having no KanbanState row.

      ArticleBinding binding
                |
                v
        missing KanbanState
                |
                v
        Kanban.ErrorCat.not_in_kanban

      Kanban command -> membership query -> Kanban error catalog
  """

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :kanban}

  error(:not_in_kanban, code: 6030)
end
