defmodule GroupherServer.CMS.Articles.Commands.PublishArticleConfirmation do
  @moduledoc """
  Stores the selected Snapshot and publication metadata for command replay.

      publishArticle transaction -> public Snapshot identity -> Receipt replay result
  """
  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :article_publish_article,
    data_keys: ["article_id", "snapshot_id", "published_by_id", "published_at", "command_id"],
    field_types: %{
      "article_id" => :string,
      "snapshot_id" => :string,
      "published_by_id" => :integer,
      "published_at" => :string,
      "command_id" => :string
    }
end
