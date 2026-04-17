-- Add granular OS-creation permission to property collaborators
ALTER TABLE property_collaborators ADD COLUMN can_open_os INTEGER NOT NULL DEFAULT 0;

-- Managers invited before this migration get can_open_os = 1 by default
UPDATE property_collaborators SET can_open_os = 1 WHERE role = 'manager';
