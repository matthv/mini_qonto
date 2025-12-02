module Api
  class Membership < Api::ApplicationRecord
    belongs_to :organization
    belongs_to :organizations_view, foreign_key: :organization_id

    has_one :deposit_account, -> { where(subject_type: "Membership") },
      as: "subject", class_name: "Api::BankAccount", inverse_of: :membership

    has_many :transactions, foreign_key: :initiator_id

    STATUS = {
      draft: 0,
      active: 1,
      revoked: 2,
      invitable: 3,
      ignored: 4,
      deleted: 5,
      invited: 6
    }.freeze

    KYC_STATUS = {
      pending: 0,
      reviewable: 1,
      submitted: 2,
      accepted: 3,
      refused: 4,
      waiting_document: 5,
      submission_error: 6,
      kyc_not_applicable: 7,
      processing: 8
    }.freeze

    KYC_SUBMISSION_ERRORS = {
      unknow_error: 0,
      address_required: 1,
      birth_country_required: 2,
      nationality_required: 3,
      other_threads_currently_uploading_documents: 4
    }.freeze

    KYC_LEVEL = {
      init: 0,
      light: 1,
      regular: 2,
      strong: 3,
      dismissed: 4,
      coming_up: 5
    }.freeze

    KYC_REVIEW = {
      review_none: 0,
      review_pending: 1,
      review_validated: 2,
      review_dismissed: 3
    }.freeze

    GENDERS = {
      male: 0,
      female: 1
    }.freeze

    ROLES = {
      owner: 0,
      admin: 1,
      employee: 2,
      reporting: 3,
      manager: 4
    }.freeze

    POWER_STATUS = {
      signature_requested: 0,
      signed: 1
    }.freeze

    enum :gender, GENDERS
    enum :role, ROLES
    enum :status, STATUS
    enum :kyc_status, KYC_STATUS
    enum :kyc_submission_error, KYC_SUBMISSION_ERRORS
    enum :kyc_level, KYC_LEVEL
    enum :kyc_review, KYC_REVIEW
    enum :power_status, POWER_STATUS

    scope :active_owner_and_admins, -> { active.where(role: ROLES.fetch_values(:owner, :admin)) }

    def full_name
      [first_name.try(:titleize),
        last_name.try(:titleize)].compact.join(" ").strip
    end

    def qonto_cbs?
      organization.qonto?
    end
  end
end
