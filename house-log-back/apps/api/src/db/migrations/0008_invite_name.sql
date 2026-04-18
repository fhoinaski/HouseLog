-- 0008: suporte a pre-cadastro de prestador sem email
-- guarda o nome informado pelo owner/admin para convites via WhatsApp

ALTER TABLE property_invites ADD COLUMN invite_name TEXT;
