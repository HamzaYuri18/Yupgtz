@@ .. @@
   prime DECIMAL(10,2) NOT NULL DEFAULT 0,
   assure TEXT NOT NULL,
   branche TEXT NOT NULL CHECK (branche IN ('Auto', 'Vie', 'Santé', 'IRDS')),
+  mode_paiement TEXT NOT NULL CHECK (mode_paiement IN ('Espèce', 'Chèque', 'Carte Bancaire')),
+  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('Au comptant', 'Crédit')),
   montant_credit DECIMAL(10,2) NOT NULL,
   date_paiement_prevue DATE,
