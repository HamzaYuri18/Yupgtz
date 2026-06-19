import { XMLContract } from '../types';

export const parseXMLFile = (file: File): Promise<XMLContract[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        // Vérifier les erreurs de parsing
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          reject(new Error('Erreur de parsing XML'));
          return;
        }
        
        const contracts: XMLContract[] = [];
        const contractElements = xmlDoc.querySelectorAll('contract');
        
        contractElements.forEach(element => {
          const contractNumber = element.querySelector('number')?.textContent || '';
          const premium = parseFloat(element.querySelector('premium')?.textContent || '0');
          const maturity = element.querySelector('maturity')?.textContent || '';
          const insured = element.querySelector('insured')?.textContent || '';
          
          if (contractNumber) {
            contracts.push({
              contractNumber,
              premium,
              maturity,
              insured
            });
          }
        });
        
        resolve(contracts);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
};

export const findContractInXML = (contracts: XMLContract[], contractNumber: string): XMLContract | null => {
  return contracts.find(contract => contract.contractNumber === contractNumber) || null;
};
