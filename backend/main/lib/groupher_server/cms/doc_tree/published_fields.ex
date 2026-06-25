defmodule GroupherServer.CMS.DocTree.PublishedFields do
  @moduledoc false

  @node_fields ~w(type title slug index href marker badge hidden expanded)a

  def node_fields, do: @node_fields
end
