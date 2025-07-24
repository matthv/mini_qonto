module Api
  class Income < Api::ApplicationRecord
    # include RiskReportConcern

    belongs_to :bank_account
    has_one :parent_transaction, as: :subject, class_name: "Api::Transaction", inverse_of: :income
    has_one :organizations_view, through: :bank_account, foreign_key: :organization_id

    alias_method :organization, :organizations_view
  end
end
