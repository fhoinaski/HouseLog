-- 0007: Provider specialties/profile + service order audio support

ALTER TABLE property_invites ADD COLUMN specialties TEXT DEFAULT '[]';
ALTER TABLE property_invites ADD COLUMN whatsapp TEXT;

ALTER TABLE property_collaborators ADD COLUMN specialties TEXT DEFAULT '[]';
ALTER TABLE property_collaborators ADD COLUMN whatsapp TEXT;

UPDATE property_collaborators
SET specialties = '[]'
WHERE specialties IS NULL;

ALTER TABLE service_orders ADD COLUMN audio_url TEXT;
