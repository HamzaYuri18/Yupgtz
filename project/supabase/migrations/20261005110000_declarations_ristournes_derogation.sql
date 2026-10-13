/*
  # Déclarations signées : ristournes / BNS et dérogations

  1. Changes
    - ristournes: declaration_validee, declaration_scan_url, declaration_derogation.
    - sinistres: declaration_derogation.
    - sinistre_declaration_codes devient générique (sinistre ou ristourne) :
      type_dossier, reference (id du sinistre ou de la ristourne),
      derogation. numero_sinistre devient optionnel.
*/

ALTER TABLE ristournes ADD COLUMN IF NOT EXISTS declaration_validee boolean NOT NULL DEFAULT false;
ALTER TABLE ristournes ADD COLUMN IF NOT EXISTS declaration_scan_url text;
ALTER TABLE ristournes ADD COLUMN IF NOT EXISTS declaration_derogation boolean NOT NULL DEFAULT false;

ALTER TABLE sinistres ADD COLUMN IF NOT EXISTS declaration_derogation boolean NOT NULL DEFAULT false;

ALTER TABLE sinistre_declaration_codes ALTER COLUMN numero_sinistre DROP NOT NULL;
ALTER TABLE sinistre_declaration_codes ADD COLUMN IF NOT EXISTS type_dossier text NOT NULL DEFAULT 'sinistre';
ALTER TABLE sinistre_declaration_codes ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE sinistre_declaration_codes ADD COLUMN IF NOT EXISTS derogation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sinistre_declaration_codes_reference
  ON sinistre_declaration_codes(type_dossier, reference, requested_by, code);

DROP POLICY IF EXISTS "Allow update ristournes declaration" ON ristournes;
CREATE POLICY "Allow update ristournes declaration"
  ON ristournes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
