defmodule GroupherServer.CMS.Model.ArticleJoinTag do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS
  alias CMS.Model.ArticleTag
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %ArticleJoinTag{}
  schema "articles_join_tags" do
    belongs_to(:article_tag, ArticleTag)

    article_belongs_to_fields()
  end
end
