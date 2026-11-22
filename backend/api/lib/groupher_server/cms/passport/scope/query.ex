defmodule GroupherServer.CMS.Passport.Scope.Query do
  @moduledoc """
  Builds Article authorization predicates without executing a query.

      authenticated actor + Global scope + Action -> Article query predicate

  Gate composes Lifecycle, Review and public visibility independently.
  """
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Article, ArticleCoAuthor, Author}
  alias CMS.Passport.{Catalog, Scope}

  @doc "Restricts an Article query to the actor's registered Article permission."
  def articles(query, %User{id: id}, %Scope.Global{actor_id: id, global: global}, action)
      when is_integer(id) do
    with {:ok, %{scope: :article} = metadata} <- Catalog.get(action),
         %Ecto.Query{from: %{source: {"articles", Article}}} = query <-
           Ecto.Queryable.to_query(query),
         {:ok, catalog} <- Catalog.list(:article) do
      owners = from(author in Author, where: author.user_id == ^id, select: author.id)
      grantable = Enum.filter(catalog, & &1.metadata.grantable)
      allowed_keys = Enum.map(grantable, & &1.action)

      valid_map =
        dynamic(
          [member],
          fragment(
            "jsonb_typeof(?) = 'object' AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(?) = 'object' THEN ? ELSE '{}'::jsonb END) AS entry(key, value) WHERE jsonb_typeof(entry.value) <> 'boolean' OR NOT (entry.key = ANY(?)))",
            member.permissions,
            member.permissions,
            member.permissions,
            ^allowed_keys
          )
        )

      valid_dependencies =
        Enum.reduce(grantable, dynamic(true), fn entry, conditions ->
          Enum.reduce(entry.metadata.requires, conditions, fn dependency, accumulated ->
            dynamic(
              [member],
              ^accumulated and
                fragment(
                  "COALESCE(? ->> ? <> 'true', true) OR COALESCE(? ->> ? = 'true', false)",
                  member.permissions,
                  ^entry.action,
                  member.permissions,
                  ^dependency
                )
            )
          end)
        end)

      required = [action | metadata.requires]

      permission_conditions =
        Enum.reduce(required, dynamic(true), fn permission, conditions ->
          dynamic(
            [member],
            ^conditions and fragment("? ->> ? = 'true'", member.permissions, ^permission)
          )
        end)

      invalid_conditions = dynamic([member], not (^valid_map and ^valid_dependencies))

      actor_members =
        from(member in ArticleCoAuthor,
          join: author in Author,
          on: author.id == member.author_id,
          where: author.user_id == ^id
        )

      invalid_members =
        from([member, _author] in actor_members,
          where: ^invalid_conditions,
          select: member.article_id
        )

      memberships =
        from([member, _author] in actor_members,
          where: ^valid_map,
          where: ^valid_dependencies,
          where: ^permission_conditions,
          select: member.article_id
        )

      cond do
        global.is_root ->
          {:ok, from(article in query, where: article.id not in subquery(invalid_members))}

        CMS.Passport.owner_article_action?(action) and metadata.grantable ->
          {:ok,
           from(article in query,
             where: article.author_id in subquery(owners) or article.id in subquery(memberships)
           )}

        CMS.Passport.owner_article_action?(action) ->
          {:ok, from(article in query, where: article.author_id in subquery(owners))}

        metadata.grantable ->
          {:ok, from(article in query, where: article.id in subquery(memberships))}

        true ->
          {:ok, from(article in query, where: false)}
      end
    else
      {:ok, _} -> {:error, :permission_scope_mismatch}
      {:error, _} = error -> error
      _ -> {:error, :invalid_scope}
    end
  end

  def articles(_, _, _, _), do: {:error, :invalid_scope}
end
