ALTER TABLE users ADD COLUMN whatsapp TEXT;
ALTER TABLE users ADD COLUMN service_area TEXT;
ALTER TABLE users ADD COLUMN pix_key TEXT;
ALTER TABLE users ADD COLUMN pix_key_type TEXT CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random'));
ALTER TABLE users ADD COLUMN provider_bio TEXT;
ALTER TABLE users ADD COLUMN provider_courses TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN provider_specializations TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN provider_portfolio TEXT NOT NULL DEFAULT '[]';
