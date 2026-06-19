import * as XLSX from 'xlsx';
import { XMLContract } from '../types';

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
