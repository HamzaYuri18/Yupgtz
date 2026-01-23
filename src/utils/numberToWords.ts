export const numberToWords = (num: number): string => {
  if (num === 0) return 'zéro';

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';

    let result = '';

    if (n >= 100) {
      const hundreds = Math.floor(n / 100);
      if (hundreds === 1) {
        result += 'cent';
      } else {
        result += units[hundreds] + ' cent';
      }
      if (n % 100 !== 0) {
        result += 's';
      }
      result += ' ';
      n %= 100;
    }

    if (n >= 20) {
      const tenDigit = Math.floor(n / 10);
      const unitDigit = n % 10;

      if (tenDigit === 7 || tenDigit === 9) {
        result += tens[tenDigit];
        if (tenDigit === 7) {
          if (unitDigit === 1) {
            result += ' et onze';
          } else {
            result += '-' + teens[unitDigit];
          }
        } else {
          if (unitDigit === 0) {
            result += 's';
          } else {
            result += '-' + teens[unitDigit];
          }
        }
      } else {
        result += tens[tenDigit];
        if (unitDigit === 1 && tenDigit !== 8) {
          result += ' et un';
        } else if (unitDigit > 0) {
          if (tenDigit === 8) {
            result += 's-' + units[unitDigit];
          } else {
            result += '-' + units[unitDigit];
          }
        } else if (tenDigit === 8) {
          result += 's';
        }
      }
    } else if (n >= 10) {
      result += teens[n - 10];
    } else if (n > 0) {
      result += units[n];
    }

    return result.trim();
  };

  let integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 1000);

  let words = '';

  if (integerPart >= 1000000) {
    const millions = Math.floor(integerPart / 1000000);
    if (millions === 1) {
      words += 'un million ';
    } else {
      words += convertLessThanThousand(millions) + ' millions ';
    }
    integerPart %= 1000000;
  }

  if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    if (thousands === 1) {
      words += 'mille ';
    } else {
      words += convertLessThanThousand(thousands) + ' mille ';
    }
    integerPart %= 1000;
  }

  words += convertLessThanThousand(integerPart);

  if (decimalPart > 0) {
    words += ' dinars et ' + convertLessThanThousand(decimalPart) + ' millimes';
  } else {
    words += ' dinars';
  }

  return words.trim();
};
