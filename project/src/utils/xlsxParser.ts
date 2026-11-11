import * as XLSX from 'xlsx';
import { XMLContract, IRDSRow } from '../types';

const cellToString = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const normalizeHeader = (header: unknown): string => {
  return cellToString(header)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const convertExcelDate = (excelDate: any): string => {
  if (!excelDate) return '';

  if (typeof excelDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(excelDate)) {
    return excelDate.split('T')[0];
  }

  if (typeof excelDate === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + excelDate * 86400000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  try {
    const date = new Date(excelDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn('Conversion date impossible:', excelDate);
  }

  return excelDate.toString();
};

export const parseXLSXFile = (file: File): Promise<XMLContract[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        // Prendre la première feuille
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        console.log('📊 Analyse du fichier XLSX:');
        console.log('  Nom de la feuille:', sheetName);

        // Convertir en JSON avec raw: true pour obtenir les valeurs brutes
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

        console.log('  Nombre de lignes:', jsonData.length);
        console.log('  En-têtes (ligne 1):', jsonData[0]);
        console.log('  Première ligne de données:', jsonData[1]);

        const contracts: XMLContract[] = [];

        // Ignorer la première ligne (en-têtes) et traiter les données
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];

          if (row && row.length >= 4) {
            const contractNumber = row[0]?.toString() || '';
            const premiumStr = row[1]?.toString() || '0';
            const premium = parseFloat(premiumStr.replace(',', '.'));
            const maturity = convertExcelDate(row[2]);
            const insured = row[3]?.toString() || '';
            const numTel = row[4]?.toString() || '';
            const numTel2 = row[5]?.toString() || '';

            console.log(`  Ligne ${i + 1}:`, {
              contractNumber,
              premiumStr,
              premium,
              maturity,
              maturityRaw: row[2],
              maturityType: typeof row[2],
              insured,
              numTel,
              numTel2,
              isValidPremium: !isNaN(premium)
            });

            if (contractNumber) {
              contracts.push({
                contractNumber,
                premium,
                maturity,
                insured,
                numTel,
                numTel2
              });
            }
          }
        }

        console.log('✅ Parsing terminé:', contracts.length, 'contrats extraits');
        resolve(contracts);
      } catch (error) {
        console.error('❌ Erreur lors du parsing XLSX:', error);
        reject(new Error('Erreur lors du parsing du fichier XLSX: ' + (error as Error).message));
      }
    };

    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
};

export const findContractInXLSX = (contracts: XMLContract[], contractNumber: string): XMLContract | null => {
  return contracts.find(contract => contract.contractNumber === contractNumber) || null;
};

export const parseIRDSXLSXFile = (file: File): Promise<IRDSRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as unknown[][];

        if (jsonData.length === 0) {
          resolve([]);
          return;
        }

        const headerRow = jsonData[0];
        const normalizedHeaders = headerRow.map(normalizeHeader);

        const colSouscripteur = normalizedHeaders.findIndex(h => h === 'souscripteur');
        const colPolice = normalizedHeaders.findIndex(h => h === 'police');
        const colDateEcheance = normalizedHeaders.findIndex(h => h.includes('echeance'));
        const colMontantTTC = normalizedHeaders.findIndex(h => h.includes('montant'));

        if (colSouscripteur === -1 || colPolice === -1 || colDateEcheance === -1 || colMontantTTC === -1) {
          reject(new Error('Colonnes attendues introuvables. Le fichier doit contenir : Souscripteur, Police, Date d\'échéance, Montant TTC'));
          return;
        }

        const rows: IRDSRow[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const souscripteur = cellToString(row[colSouscripteur]);
          const police = cellToString(row[colPolice]);
          const dateEcheance = convertExcelDate(row[colDateEcheance]);
          const montantStr = cellToString(row[colMontantTTC]) || '0';
          const montantTTC = parseFloat(montantStr.replace(',', '.')) || 0;

          if (souscripteur || police) {
            rows.push({ souscripteur, police, dateEcheance, montantTTC });
          }
        }

        resolve(rows);
      } catch (error) {
        console.error('❌ Erreur lors du parsing XLSX IRDS:', error);
        reject(new Error('Erreur lors du parsing du fichier IRDS: ' + (error as Error).message));
      }
    };

    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsArrayBuffer(file);
  });
};
