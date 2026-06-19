import { Contract, XMLContract } from '../types';
import * as XLSX from 'xlsx';

export const saveContract = (contract: Contract): void => {
  const contracts = getContracts();
  contracts.push(contract);
  localStorage.setItem('contracts', JSON.stringify(contracts));
};

export const getContracts = (): Contract[] => {
  const contractsData = localStorage.getItem('contracts');
  return contractsData ? JSON.parse(contractsData) : [];
};

export const saveXMLContracts = (contracts: XMLContract[]): void => {
  localStorage.setItem('xmlContracts', JSON.stringify(contracts));
};

export const getXMLContracts = (): XMLContract[] => {
  const xmlData = localStorage.getItem('xmlContracts');
  return xmlData ? JSON.parse(xmlData) : [];
};

export const generateContractId = (): string => {
  return `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const exportToXLSX = (contracts: Contract[], filename: string): void => {
  const headers = [
    'ID', 'Type', 'Branche', 'Numéro', 'Prime (DT)', 'Assuré', 
    'Mode Paiement', 'Type Paiement', 'Créé par', 'Date création'
  ];
  
  const data = contracts.map(contract => [
    contract.id,
    contract.type,
    contract.branch,
    contract.contractNumber,
    contract.premiumAmount,
    contract.insuredName,
    contract.paymentMode,
    contract.paymentType,
    contract.createdBy,
    new Date(contract.createdAt).toLocaleDateString('fr-FR')
  ]);
  
  const wsData = [headers, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contrats');
  
  XLSX.writeFile(wb, filename);
};
