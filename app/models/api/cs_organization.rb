module Api
  class CsOrganization < Api::ApplicationRecord
    belongs_to :organization
    belongs_to :organizations_view, foreign_key: :organization_id
  end
end