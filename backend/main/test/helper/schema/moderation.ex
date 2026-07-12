defmodule GroupherServer.Test.Helper.Schema.Moderation do
  @moduledoc "GraphQL documents used by moderation tests."

  def m(:remove_moderator) do
    """
    mutation($community: String!, $user: String!){
          removeModerator(community: $community, user: $user) {
            slug
          }
        }
    """
  end

  def m(:update_moderator_passport) do
    """
    mutation($community: String!, $user: String!, $rules: Json!){
          updateModeratorPassport(community: $community, user: $user, rules: $rules) {
            slug
            moderators {
              isRoot
              passportItemCount
              user {
                login
                nickname
              }
            }
          }
        }
    """
  end

  def m(:add_moderators) do
    """
    mutation($community: String!, $users: [String!]!){
          addModerators(community: $community, users: $users) {
            slug
            moderators {
              isRoot
              user {
                login
              }
            }
          }
        }
    """
  end

  def m(:add_moderator) do
    """
    mutation($community: String!, $user: String!){
          addModerator(community: $community, user: $user) {
            slug
          }
        }
    """
  end

  def q(:paged_abuse_reports_2) do
    """
    query($filter: ReportFilter!) {
          pagedAbuseReports(filter: $filter) {
            entries {
              id
              dealWith
              operateUser {
                login
              }
              comment {
                innerId
                bodyHtml
                author {
                  login
                }
              }
              account {
                login
              }
              reportCases {
                reason
                attr
                user {
                  login
                }
              }
            }
            totalPages
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end

  def q(:paged_community_moderators) do
    """
    query($community: String!, $filter: PagiFilter!) {
          pagedCommunityModerators(community: $community, filter: $filter) {
            entries {
              nickname
            }
            totalCount
            totalPages
            pageSize
            pageNumber
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

  def q(:paged_abuse_reports) do
    """
    query($filter: ReportFilter!) {
          pagedAbuseReports(filter: $filter) {
            entries {
              id
              dealWith
              article {
                innerId
                thread
                title
              }
              operateUser {
                login
              }
              comment {
                innerId
                bodyHtml
                author {
                  login
                }
              }
              reportCases {
                reason
                attr
                user {
                  login
                }
              }
            }
            totalPages
            totalCount
            pageSize
            pageNumber
          }
        }
    """
  end
end
