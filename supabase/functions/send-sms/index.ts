import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SMS_API_KEY = "0FbaiuI8iMYugnky9VJdQPg9DVH36Z23l6dB0tr6bJWkg8j2tyFckyaW4O99j0XzdZmeBVNH9pq8k3ZCwQAH/-/umLYnLdCjOfiVBtK8FkxgD9h7evSCCxhA==";
const SMS_SENDER = "STAR SHIRI";
const SMS_API_URL = "https://api.l2t.io/tn/v0/api/api.aspx";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { mobile, message } = await req.json();

    if (!mobile || !message) {
      return new Response(
        JSON.stringify({ error: "Mobile et message sont requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formattedMobile = mobile.startsWith("216") ? mobile : `216${mobile}`;
    const encodedMessage = encodeURIComponent(message);

    const smsUrl = `${SMS_API_URL}?fct=sms&key=${SMS_API_KEY}&mobile=${formattedMobile}&sms=${encodedMessage}&sender=${encodeURIComponent(SMS_SENDER)}`;

    const response = await fetch(smsUrl);
    const xmlText = await response.text();

    const statusCodeMatch = xmlText.match(/<status_code>(\d+)<\/status_code>/);
    const statusMsgMatch = xmlText.match(/<status_msg>!\[CDATA\[(.*?)\]\]<\/status_msg>/);
    const messageIdMatch = xmlText.match(/<message_id>(.*?)<\/message_id>/);

    const statusCode = statusCodeMatch ? parseInt(statusCodeMatch[1]) : 500;
    const statusMsg = statusMsgMatch ? statusMsgMatch[1] : "Unknown";
    const messageId = messageIdMatch ? messageIdMatch[1] : null;

    if (statusCode === 200) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "SMS envoyé avec succès",
          messageId,
          statusCode,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      const errorMessages: { [key: number]: string } = {
        400: "Absence de clé API",
        401: "Clé non autorisée",
        402: "Solde insuffisant",
        420: "Quota quotidien dépassé",
        430: "Contenu manquant",
        431: "Destination manquante",
        440: "Contenu trop long",
        441: "Destination non autorisée",
        442: "Expéditeur non autorisé",
        500: "Erreur serveur interne",
      };

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessages[statusCode] || statusMsg,
          statusCode,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi du SMS:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erreur lors de l'envoi du SMS",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
