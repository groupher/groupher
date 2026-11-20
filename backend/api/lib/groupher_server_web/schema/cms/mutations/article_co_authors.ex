defmodule GroupherServerWeb.Schema.CMS.Mutations.ArticleCoAuthors do
  @moduledoc """
  Exposes Article co-author request and membership commands at the GraphQL boundary.

      authenticated GraphQL mutation -> actor-scoped Receipt command -> Article membership / request result
  """
  use Helper.GqlSchemaSuite

  object :cms_article_co_author_mutations do
    @desc "Create an Article co-author invitation or submit the current user's application"
    field :create_article_co_author_request, non_null(:article_co_author_request) do
      arg(:article_id, non_null(:id))
      arg(:subject_login, :string)
      arg(:type, non_null(:article_co_author_request_type))
      arg(:permissions, non_null(:json))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.create/3)
    end

    @desc "Accept or reject an Article co-author invitation or application"
    field :decide_article_co_author_request, non_null(:article_co_author_request) do
      arg(:request_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:decision, non_null(:article_co_author_decision))
      arg(:approved_permissions, :json)
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.decide/3)
    end

    @desc "Cancel a pending Article co-author request at its current revision"
    field :cancel_article_co_author_request, non_null(:article_co_author_request) do
      arg(:request_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.cancel/3)
    end

    @desc "Replace one co-author's grantable Article permissions at its current revision"
    field :update_article_co_author_permissions, non_null(:article_co_author) do
      arg(:article_id, non_null(:id))
      arg(:member_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:permissions, non_null(:json))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.update_permissions/3)
    end

    @desc "Remove one current Article co-author membership"
    field :remove_article_co_author, non_null(:article_co_author) do
      arg(:article_id, non_null(:id))
      arg(:member_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.remove/3)
    end

    @desc "Leave the current user's Article co-author membership"
    field :leave_article_co_authors, non_null(:article_co_author) do
      arg(:article_id, non_null(:id))
      arg(:revision, non_null(:integer))
      arg(:command_id, non_null(:id))

      middleware(M.Authorize, :login)
      resolve(&R.CMS.ArticleCoAuthors.leave/3)
    end
  end
end
