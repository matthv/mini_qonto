module Api
  class Transaction < Api::ApplicationRecord
    belongs_to :bank_account
    belongs_to :subject, polymorphic: true

    belongs_to :income, class_name: "Api::Income", inverse_of: :parent_transaction, primary_key: :id, foreign_key: :subject_id

    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id
  end
end