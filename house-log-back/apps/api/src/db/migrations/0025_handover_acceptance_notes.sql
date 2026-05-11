-- P3-HANDOVER-07: persist optional public acceptance notes.

ALTER TABLE handover_packages ADD COLUMN acceptance_notes TEXT;
