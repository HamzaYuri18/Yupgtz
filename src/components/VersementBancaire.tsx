// Dans sessionService.ts
export const updateSessionRemarque = async (sessionId: number, remarque: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/sessions/update-remarque', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        remarque
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la mise à jour de la remarque');
    }

    return true;
  } catch (error) {
    console.error('Erreur updateSessionRemarque:', error);
    return false;
  }
};

// Et mettez à jour la fonction updateSessionVersement pour inclure la remarque :
export const updateSessionVersement = async (
  sessionId: number, 
  versement: number, 
  dateVersement: string, 
  banque: string, 
  charges: number,
  remarque?: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/sessions/update-versement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        versement,
        dateVersement,
        banque,
        charges,
        remarque
      }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la mise à jour du versement');
    }

    return true;
  } catch (error) {
    console.error('Erreur updateSessionVersement:', error);
    return false;
  }
};