defmodule GroupherServerWeb.Schema do
  @moduledoc """
  Root Absinthe schema assembling Groupher's account, CMS, analysis, and helper APIs.

  Business position:

      HTTP / WebSocket client
        -> Phoenix endpoint
        -> Schema
        -> web or domain boundary
  """
  use Absinthe.Schema
  import GroupherServerWeb.Schema.Helper.Imports

  alias GroupherServerWeb.Middleware, as: M
  alias GroupherServerWeb.Schema.{Account, AlertWall, Analysis, CMS, Helper, ReviewBot}

  import_types(Absinthe.Type.Custom)

  # utils
  import_types(Helper.Metrics)

  # account
  import_types(Account.Types)
  import_types(Account.Queries)
  import_types(Account.Mutations)

  # cms
  import_types(CMS.Types)
  import_types(CMS.Review.Types)
  import_types(CMS.Review.Mutations)
  import_types(CMS.Press.Types)
  import_types(CMS.Press.Queries)
  import_types(CMS.Press.Mutations)
  import_types(Analysis.Types)
  import_types(AlertWall.Types)
  import_types(AlertWall.Queries)
  import_types(AlertWall.Mutations)
  import_types(ReviewBot.Types)
  import_types(ReviewBot.Queries)
  import_types(ReviewBot.Mutations)
  import_types(CMS.ContentImport.Types)
  import_types(CMS.Queries)
  import_types(CMS.Review.Queries)
  import_types(CMS.ContentImport)
  import_types(CMS.Mutations.Community)
  import_types(CMS.Mutations.Operation)

  import_types(CMS.Mutations.Comment)
  import_types(CMS.Mutations.Dashboard)
  import_types(CMS.Mutations.DocTree)

  import_article_fields(:mutations, :module)

  query do
    import_fields(:account_queries)
    import_fields(:cms_queries)
    import_fields(:cms_review_queries)
    import_fields(:cms_press_queries)
    import_fields(:cms_content_import_queries)
    import_fields(:alert_wall_queries)
    import_fields(:review_bot_queries)
  end

  mutation do
    # account
    import_fields(:account_mutations)
    # cms
    import_fields(:cms_mutation_community)
    import_fields(:cms_operation_mutations)

    import_article_fields(:mutations)

    import_fields(:cms_comment_mutations)
    import_fields(:cms_dsb_mutations)
    import_fields(:cms_press_mutations)
    import_fields(:cms_doc_tree_mutations)
    import_fields(:cms_content_import_mutations)
    import_fields(:cms_review_mutations)
    import_fields(:review_bot_mutations)
    import_fields(:alert_wall_mutations)
  end

  def middleware(middleware, _field, _object) do
    middleware ++ [M.GQLResultFmt, M.ChangesetErrors, M.GeneralError]
  end

  def plugins do
    [Absinthe.Middleware.Dataloader | Absinthe.Plugin.defaults()]
  end

  def dataloader do
    alias GroupherServer.{Accounts, CMS}

    Dataloader.new()
    |> Dataloader.add_source(Accounts, Accounts.dataloader_source())
    |> Dataloader.add_source(CMS, CMS.dataloader_source())
  end

  def context(ctx) do
    ctx |> Map.put(:loader, dataloader())
  end
end
