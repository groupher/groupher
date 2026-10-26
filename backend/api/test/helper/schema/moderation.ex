defmodule GroupherServer.Test.Helper.Schema.Moderation do
  @moduledoc "GraphQL documents used by moderation tests."

  def m(:remove_moderator) do
    """
    mutation($community: String!, $user: String!, $commandId: ID!){
          removeModerator(community: $community, user: $user, commandId: $commandId) {
            slug
          }
        }
    """
  end

  def m(:update_moderator_passport) do
    """
    mutation($community: String!, $user: String!, $rules: Json!, $commandId: ID!){
          updateModeratorPassport(community: $community, user: $user, rules: $rules, commandId: $commandId) {
            slug
          }
        }
    """
  end

  def m(:add_moderators) do
    """
    mutation($community: String!, $users: [String!]!, $commandId: ID!){
          addModerators(community: $community, users: $users, commandId: $commandId) {
            slug
          }
        }
    """
  end

  def m(:add_moderator) do
    """
    mutation($community: String!, $user: String!, $commandId: ID!){
          addModerator(community: $community, user: $user, commandId: $commandId) {
            slug
          }
        }
    """
  end

  def q(:paged_community_moderators) do
    """
    query($community: String!, $filter: UserListFilter, $pagi: PagiInput) {
          pagedCommunityModerators(community: $community, filter: $filter, pagi: $pagi) {
            entries {
              id isRoot passportItemCount user { login nickname }
            }
            pageInfo { hasNextPage ... on OffsetPageInfo { page size totalCount totalPages } ... on CursorPageInfo { endCursor } }
          }
        }
    """
  end

  def q(:all_passport_rules) do
    """
    query {
          allPassportRules {
            root
            moderator
          }
        }
    """
  end

  def q(:all_passport_rules_string) do
    """
    query {
          allPassportRulesString {
            cms
          }
        }
    """
  end

end
