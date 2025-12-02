class Forest::CardClaimMastercomClaim
  include ForestLiana::Collection

  collection :CardClaim__MastercomClaim

  ["Pending", "Pending Documentation", "Issuer Worked", "Fee Collection Unworked", "Issuer Re-presentment Unworked", "Rejects", "Closed"].each do |queue|
    segment queue do
      {id: CardClaim::MastercomClaim.where(queue: queue).where("snooze_till IS NULL OR snooze_till < NOW()").pluck(:id)}
    end
  end
end
