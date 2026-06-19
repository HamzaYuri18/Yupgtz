import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Vérifier que les variables d'environnement sont définies et valides
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `❌ Variables d'environnement Supabase manquantes:
VITE_SUPABASE_URL: ${supabaseUrl ? '✅ Définie' : '❌ Manquante'}
VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✅ Définie' : '❌ Manquante'}

Veuillez vérifier votre fichier .env et vous assurer que ces variables sont correctement définies.`
  
  console.error(errorMessage)
  throw new Error('Configuration Supabase invalide: Variables d\'environnement manquantes')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: {
          id: number
          numero_contrat: string
          prime: number
          assure: string
          echeance: string
          created_at: string
        }
        Insert: {
          numero_contrat: string
          prime: number
          assure: string
          echeance: string
        }
        Update: {
          numero_contrat?: string
          prime?: number
          assure?: string
          echeance?: string
        }
      }
    }
  }
}
