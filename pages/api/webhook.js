module.exports = async (req, res) => {
  const VERIFY_TOKEN = 'token';  // Coloque seu token de verificação aqui

  // Método GET para verificação do webhook
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verificar se o token de verificação corresponde ao esperado
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified');
      return res.status(200).send(challenge);  // Responde com o challenge para validar o webhook
    } else {
      return res.status(403).send('Forbidden');  // Se o token não for válido, retorna 403
    }
  }

  // Método POST para processar as mensagens recebidas
  if (req.method === 'POST') {
    try {
      // O corpo da requisição contém a mensagem recebida
      const body = req.body;

      // Verificar se a requisição contém mensagens
      if (body.object) {
        const entries = body.entry;
        for (let i = 0; i < entries.length; i++) {
          const changes = entries[i].changes;
          for (let j = 0; j < changes.length; j++) {
            const messages = changes[j].value.messages;

            if (messages && messages.length > 0) {
              // Extrair dados da mensagem
              const message = messages[0];
              const sender = message.from; // Número do remetente
              const text = message.text.body; // Conteúdo da mensagem

              // Log da mensagem recebida
              console.log(`Mensagem recebida de ${sender}: ${text}`);

              // Aqui você pode processar a mensagem, por exemplo, armazenar ou responder automaticamente
              // Exemplo de resposta automática ou qualquer outro processamento
            }
          }
        }
        return res.status(200).json({ status: 'Message received' });
      } else {
        return res.status(404).send('No object found');
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ status: 'Error', error: error.message });
    }
  }

  // Método para casos onde o método não é GET nem POST
  res.status(405).json({ status: 'Method Not Allowed' });
};
