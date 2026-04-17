-- Migration 0005: recurring expenses, expense type, inventory warranty

-- expenses: add recurring support + revenue/expense type
ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('expense','revenue'));
ALTER TABLE expenses ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN recurrence_group TEXT;

-- inventory_items: add warranty tracking
ALTER TABLE inventory_items ADD COLUMN warranty_until TEXT;

-- index for warranty lookups
CREATE INDEX IF NOT EXISTS idx_inventory_warranty ON inventory_items(property_id, warranty_until)
  WHERE deleted_at IS NULL AND warranty_until IS NOT NULL;
