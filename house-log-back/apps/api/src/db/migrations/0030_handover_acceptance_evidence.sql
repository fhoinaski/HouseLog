-- Migration 0030: Handover acceptance evidence fields
-- Adds IP address, user-agent, and optional canvas signature storage
-- to the handover_packages table for complete probatory trail.

ALTER TABLE handover_packages ADD COLUMN accepted_ip TEXT;
ALTER TABLE handover_packages ADD COLUMN accepted_user_agent TEXT;
ALTER TABLE handover_packages ADD COLUMN accepted_signature_data_url TEXT;
