module Api
  class Income < Api::ApplicationRecord
    belongs_to :bank_account
    has_one :parent_transaction, as: :subject, class_name: "Api::Transaction", inverse_of: :subject
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id

    alias_method :organization, :organizations_view
  end
end
