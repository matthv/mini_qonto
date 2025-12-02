module CardClaim
  class Claim < CardClaim::ApplicationRecord
    self.inheritance_column = :_type_disabled

    belongs_to :cs_organization, class_name: "Api::CsOrganization", foreign_key: :organization_id, primary_key: :organization_id, optional: true

    has_many :disputed_transactions, class_name: "CardClaim::DisputedTransaction", foreign_key: :claim_id
    has_many :disputed_active_transactions, -> { where(deleted_at: nil) }, class_name: "CardClaim::DisputedTransaction", foreign_key: :claim_id
    has_many :supporting_documents, class_name: "CardClaim::SupportingDocument", foreign_key: :claim_id
    has_many :cs_notes, -> { order(created_at: :desc) }, class_name: "CardClaim::Note", foreign_key: :claim_id

    DISPUTE_TYPES = {
      atm: "atm",
      fraud: "fraud",
      commercial: "commercial"
    }.freeze

    CATEGORIES = {
      atm_lt_50: "atm_lt_50",
      atm_gte_50: "atm_gte_50",
      cd_lt_50: "cd_lt_50",
      cd_gte_50: "cd_gte_50",
      fraud_lt_200: "fraud_lt_200",
      fraud_gte_200: "fraud_gte_200"
    }.freeze

    ESCALATION_LEVELS = {
      to_be_reviewed_by_fl: "to_be_reviewed_by_fl",
      fl_info_requested: "fl_info_requested",
      to_be_reviewed_by_bl: "to_be_reviewed_by_bl",
      bl_info_requested: "bl_info_requested",
      to_be_reviewed_by_bo: "to_be_reviewed_by_bo",
      bo_info_requested: "bo_info_requested",
      ongoing_with_monext: "ongoing_with_monext",
      ongoing_with_mastercard: "ongoing_with_mastercard",
      closed: "closed",
      archived: "archived"
    }.freeze

    ESCALATION_TAGS = {
      waiting_for_settlement: "waiting_for_settlement",
      ko_missing_document: "ko_missing_document",
      ko_incomplete_description: "ko_incomplete_description",
      ko_missing_cs_notes: "ko_missing_cs_notes",
      ko_system_failure: "ko_system_failure",
      ko_2nd_presentment: "ko_2nd_presentment",
      ko_missing_translation: "ko_missing_translation",
      ko_card_not_opposed: "ko_card_not_opposed",
      ko_wrong_type: "ko_wrong_type",
      ko_other: "ko_other"
    }.freeze

    AUTOMATIC_DECISIONS = {
      approved: "approved",
      rejected: "rejected",
      manual_review: "manual_review",
      not_applicable: "not_applicable"
    }.freeze

    enum :type, DISPUTE_TYPES
    enum :category, CATEGORIES
    enum :escalation_level, ESCALATION_LEVELS
    enum :escalation_tag, ESCALATION_TAGS
    enum :automatic_decision, AUTOMATIC_DECISIONS

    def number_of_tx
      disputed_active_transactions.length
    end

    def number_of_refunded_tx
      disputed_active_transactions.count { |tx| tx.refunded? }
    end

    def number_of_rejected_tx
      disputed_active_transactions.count { |tx| tx.not_refunded? }
    end

    def total_amount
      disputed_active_transactions.map { |tx| tx.amount_in_eur_cents || 0 }.sum
    end

    def refunded_amount
      disputed_active_transactions.reduce(0) do |sum, tx|
        tx.refunded? ? sum + (tx.refunded_amount_in_eur_cents || 0) : sum
      end
    end

    def rejected_amount
      disputed_active_transactions.reduce(0) do |sum, tx|
        tx.not_refunded? ? sum + (tx.amount_in_eur_cents || 0) : sum
      end
    end

    def vip
      cs_organization&.vip
    end

    def cs_note
      str = ""
      cs_notes.each do |note|
        time = Time.find_zone("UTC").parse(note.created_at.to_s)
        formatted_time = time.in_time_zone("Europe/Paris").strftime("[%d-%m-%Y %H:%M]")
        str += "#{note.author} #{formatted_time}\n#{note.note}\n\n"
      end
      str
    end
  end
end
