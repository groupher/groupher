defmodule GroupherServerWeb.Schema do
  @moduledoc """
  schema index for all modules
  """
  use Absinthe.Schema
  import GroupherServerWeb.Schema.Helper.Imports

  alias GroupherServerWeb.Middleware, as: M
  alias GroupherServerWeb.Schema.{Account, Payment, CMS, Statistics, Helper}

  import_types(Absinthe.Type.Custom)

  # utils
  import_types(Helper.Metrics)

  # account
  import_types(Account.Types)
  import_types(Account.Queries)
  import_types(Account.Mutations)

  # Payment
  import_types(Payment.Types)
  import_types(Payment.Queries)
  import_types(Payment.Mutations)

  # statistics
  import_types(Statistics.Types)
  import_types(Statistics.Queries)
  import_types(Statistics.Mutations)

  # cms
  import_types(CMS.Types)
  import_types(CMS.Queries)
  import_types(CMS.Mutations.Community)
  import_types(CMS.Mutations.Operation)

  import_types(CMS.Mutations.Comment)
  import_types(CMS.Mutations.Dashboard)

  import_article_fields(:mutations, :module)

  query do
    import_fields(:account_queries)
    import_fields(:payment_queries)
    import_fields(:statistics_queries)
    import_fields(:cms_queries)
  end

  mutation do
    # account
    import_fields(:account_mutations)
    # payment
    import_fields(:payment_mutations)
    # statistics
    import_fields(:statistics_mutations)
    # cms
    import_fields(:cms_mutation_community)
    import_fields(:cms_operation_mutations)

    import_article_fields(:mutations)

    import_fields(:cms_comment_mutations)
    import_fields(:cms_dashboard_mutations)
  end

  def middleware(middleware, _field, %{identifier: :query}) do
    middleware ++ [M.GeneralError]
  end

  def middleware(middleware, _field, %{identifier: :mutation}) do
    middleware ++ [M.ChangesetErrors]
  end

  def middleware(middleware, _field, _object) do
    middleware
  end

  def plugins do
    [Absinthe.Middleware.Dataloader | Absinthe.Plugin.defaults()]
  end

  def dataloader do
    alias GroupherServer.{Accounts, CMS}

    Dataloader.new()
    |> Dataloader.add_source(Accounts, Accounts.Helper.Loader.data())
    |> Dataloader.add_source(CMS, CMS.Helper.Loader.data())
  end

  def context(ctx) do
    ctx |> Map.put(:loader, dataloader())
  end
end
