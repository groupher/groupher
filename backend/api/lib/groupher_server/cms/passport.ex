defmodule GroupherServer.CMS.Passport do
  @moduledoc """
  Ownership namespace for CMS Passport facts.

  Passport is shared authorization data, not a Gate child module. Scoped fact persistence and
  authorization seams live below this namespace while Gate only
  consumes the authorization result.

      API / Gate policy
        -> CMS.Passport.Authorization
        -> Catalog / Store
        -> typed Passport facts
  """

  alias __MODULE__.{Authorization, Store}
  alias __MODULE__.Scope.{Article, Community, Global}

  @doc "Checks a Passport action against the supplied context."
  defdelegate check(user, action, context \\ %{}), to: Authorization
  @doc "Authorizes a review action through the Passport boundary."
  defdelegate authorize(user, action), to: Authorization
  @doc "Checks whether a stable user identity has the system-root Passport fact."
  defdelegate system_root?(user_id), to: __MODULE__.Store

  @doc "Lists the registered Passport Actions for a scope."
  defdelegate catalog(scope), to: __MODULE__.Catalog, as: :list

  @doc "Loads Global facts for one authenticated actor."
  defdelegate load_global_scope(actor), to: Store

  @doc "Reads normalized Global Passport facts for a stable user identity."
  defdelegate global_facts(user_id), to: Store

  @doc "Loads Community facts for one authenticated actor and canonical Community."
  defdelegate load_community_scope(actor, community), to: Store

  @doc "Loads the current review-read scopes from the canonical Passport rows."
  defdelegate review_scope_grants(actor), to: Store

  @doc "Reads normalized Community membership facts for one user and Community."
  defdelegate community_facts(user_id, community_id), to: Store

  @doc "Loads Article facts for one authenticated actor and canonical Article."
  defdelegate load_article_scope(actor, article), to: Store

  @doc "Checks actor-bound Community facts for one Action."
  def allowed?(actor, %Community{} = scope, action) do
    Store.allowed_community?(actor, scope, action)
  end

  def allowed?(actor, %Global{} = scope, action) do
    Store.allowed_global?(actor, scope, action)
  end

  def allowed?(actor, %Article{} = scope, action) do
    Store.allowed_article?(actor, scope, action)
  end

  def allowed?(_, _, _), do: {:error, :invalid_scope}

  def allowed?(actor, %Community{} = scope, action, thread) do
    Store.allowed_community?(actor, scope, action, thread)
  end

  def allowed?(actor, %Global{} = scope, action, thread) do
    Store.allowed_global?(actor, scope, action, thread)
  end

  def allowed?(_, _, _, _), do: {:error, :invalid_scope}

  @doc "Checks actor-bound Community facts for one Action and optional thread."
  def allowed_community?(actor, scope, action, thread \\ nil) do
    Store.allowed_community?(actor, scope, action, thread)
  end

  @doc "Checks actor-bound Global facts for one Article query Action."
  def scope_articles(query, actor, scope, action) do
    __MODULE__.Scope.articles(query, actor, scope, action)
  end

  @doc "Grants Community permissions under the caller's transaction."
  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{
          subject_id: user_id,
          community_id: community_id,
          member: %GroupherServer.CMS.Model.CommunityAdmin{revision: revision} = member
        },
        permissions,
        revision
      )
      when is_map(permissions) do
    Store.grant_community_in_transaction(user_id, community_id, member, permissions)
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.GlobalGrant{subject_id: user_id, current: current},
        permissions,
        _revision
      )
      when is_map(permissions) do
    Store.grant_global_in_transaction(user_id, current, permissions)
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.GlobalGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{subject_id: user_id},
        permissions,
        _
      )
      when not is_map(permissions) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{subject_id: user_id},
        _,
        _
      ) do
    {:error, :permission_revision_conflict}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.CommunityGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %Article{actor_id: user_id, membership: nil},
        permissions,
        _
      )
      when is_map(permissions) do
    {:error, :article_membership_unavailable}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{
          subject_id: user_id,
          article_id: article_id,
          member: %GroupherServer.CMS.Model.ArticleCoAuthor{revision: revision} = member
        },
        permissions,
        revision
      )
      when is_map(permissions) do
    Store.grant_article_in_transaction(user_id, article_id, member, permissions)
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{subject_id: user_id},
        permissions,
        _
      )
      when not is_map(permissions) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{
          subject_id: user_id,
          member: %GroupherServer.CMS.Model.ArticleCoAuthor{}
        },
        _,
        _
      ) do
    {:error, :permission_revision_conflict}
  end

  def grant_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.ArticleGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(%GroupherServer.Accounts.Model.User{}, %Article{}, _, _) do
    {:error, :invalid_scope}
  end

  def grant_in_transaction(_, _, _, _), do: {:error, :permission_revision_conflict}

  @doc "Revokes scoped Passport permissions under the caller's transaction."
  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{
          subject_id: user_id,
          community_id: community_id,
          member: %GroupherServer.CMS.Model.CommunityAdmin{revision: revision} = member
        },
        removals,
        revision
      )
      when is_list(removals) do
    Store.revoke_community_in_transaction(user_id, community_id, member, removals)
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.GlobalGrant{subject_id: user_id, current: current},
        removals,
        _revision
      )
      when is_list(removals) do
    Store.revoke_global_in_transaction(user_id, current, removals)
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.GlobalGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{subject_id: user_id},
        removals,
        _
      )
      when not is_list(removals) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.CommunityGrant{subject_id: user_id},
        _,
        _
      ) do
    {:error, :permission_revision_conflict}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.CommunityGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{
          subject_id: user_id,
          article_id: article_id,
          member: %GroupherServer.CMS.Model.ArticleCoAuthor{revision: revision} = member
        },
        removals,
        revision
      )
      when is_list(removals) do
    Store.revoke_article_in_transaction(user_id, article_id, member, removals)
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{subject_id: user_id},
        removals,
        _
      )
      when not is_list(removals) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %__MODULE__.Scope.ArticleGrant{
          subject_id: user_id,
          member: %GroupherServer.CMS.Model.ArticleCoAuthor{}
        },
        _,
        _
      ) do
    {:error, :permission_revision_conflict}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{},
        %__MODULE__.Scope.ArticleGrant{},
        _,
        _
      ) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(
        %GroupherServer.Accounts.Model.User{id: user_id},
        %Article{actor_id: user_id, membership: nil},
        removals,
        _
      )
      when is_list(removals) do
    {:error, :article_membership_unavailable}
  end

  def revoke_in_transaction(%GroupherServer.Accounts.Model.User{}, %Article{}, _, _) do
    {:error, :invalid_scope}
  end

  def revoke_in_transaction(_, _, _, _), do: {:error, :permission_revision_conflict}

  @doc "Returns whether Article ownership can authorize an Action without a membership grant."
  def owner_article_action?(action) do
    case __MODULE__.Catalog.get(action) do
      {:ok, %{scope: :article, owner_only: true}} -> true
      _ -> false
    end
  end
end
