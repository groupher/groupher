defmodule GroupherServerWeb.Schema.CMS.CoAuthor.Spec do
  @moduledoc """
  Defines the public GraphQL shapes for Article co-author membership, requests, and viewer permissions.

      Article co-author domain results -> typed GraphQL values -> authorized client projection
  """
  use Helper.GqlSchemaSuite

  import GroupherServerWeb.Schema.Helper.Fields

  enum :article_co_author_request_type do
    value(:invite)
    value(:apply)
  end

  enum :article_co_author_request_status do
    value(:pending)
    value(:decided)
    value(:cancelled)
    value(:expired)
  end

  enum :article_co_author_decision do
    value(:accept)
    value(:reject)
  end

  object :article_co_author do
    field(:member_id, non_null(:id))
    field(:article_id, non_null(:id))
    field(:author_id, non_null(:id))
    field(:revision, non_null(:integer))
    field(:permissions, non_null(list_of(non_null(:passport_action))))
    field(:joined_at, non_null(:datetime))
    field(:user, non_null(:common_user))
  end

  object :article_co_author_page do
    field(:entries, non_null(list_of(non_null(:article_co_author))))
    pagi_fields()
  end

  object :article_co_author_request do
    field(:id, non_null(:id))
    field(:article_id, non_null(:id))
    field(:subject_user_id, non_null(:id))
    field(:created_by_id, non_null(:id))
    field(:type, non_null(:article_co_author_request_type))
    field(:status, non_null(:article_co_author_request_status))
    field(:decision, :article_co_author_decision)
    field(:revision, non_null(:integer))
    field(:proposed_permissions, non_null(:json))
    field(:approved_permissions, :json)
    field(:expires_at, non_null(:datetime))
    field(:decided_at, :datetime)
    field(:cancelled_at, :datetime)
    field(:subject_user, :common_user)
    field(:created_by, :common_user)
    field(:current_member, :article_co_author)
  end

  object :article_co_author_request_page do
    field(:entries, non_null(list_of(non_null(:article_co_author_request))))
    pagi_fields()
  end

  object :article_permissions do
    field(:article_id, non_null(:id))
    field(:is_owner, non_null(:boolean))
    field(:permissions, non_null(list_of(non_null(:passport_action))))
  end
end
