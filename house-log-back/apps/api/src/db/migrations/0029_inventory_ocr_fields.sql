-- Migration: adiciona serial_number a inventory_items
-- Contexto: suporte a OCR de etiqueta técnica de equipamentos (FASE 2 inventory label OCR).
-- serial_number é opcional — itens existentes ficam com NULL.

ALTER TABLE inventory_items ADD COLUMN serial_number TEXT;
