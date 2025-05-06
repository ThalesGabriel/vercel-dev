import Jimp from 'jimp';
import QrCode from 'qrcode-reader';
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: true,
  },
};

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = 'meu-token-secreto'; // use o mesmo no painel da Meta

export default async function handler(req, res) {
  // ✅ Etapa 1: Verificação da URL de callback (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado com sucesso');
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Verificação falhou');
    }
  }

  // ✅ Etapa 2: Processamento da mensagem recebida (POST)
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];
    const mediaId = message?.image?.id;

    if (!mediaId) {
      return res.status(400).json({ error: 'No image media ID found in the webhook payload.' });
    }

    // Buscar a URL da mídia
    const mediaRes = await fetch(`https://graph.facebook.com/v16.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    });
    const mediaJson = await mediaRes.json();
    const mediaUrl = mediaJson.url;

    if (!mediaUrl) {
      return res.status(400).json({ error: 'No media URL found' });
    }

    // Baixar a imagem
    const imageRes = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
    });
    const imageBuffer = await imageRes.buffer();

    // Ler QR Code
    const image = await Jimp.read(imageBuffer);
    const qr = new QrCode();
    const qrText = await new Promise((resolve, reject) => {
      qr.callback = (err, value) => {
        if (err) reject(err);
        else resolve(value.result);
      };
      qr.decode(image.bitmap);
    });

    console.log('QR Code text:', qrText);

    // Acessar a página da Sefaz
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(qrText, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText : '';
      };

      const estabelecimento = getText('.nomeEmit');
      const itens = [...document.querySelectorAll('.listagemProdutos tbody tr')].map((row) => {
        const cols = row.querySelectorAll('td');
        return {
          nome: cols[0]?.innerText.trim(),
          quantidade: cols[1]?.innerText.trim(),
          preco: cols[2]?.innerText.trim(),
          total: cols[3]?.innerText.trim(),
        };
      });

      return { estabelecimento, itens };
    });

    console.log('Estabelecimento:', data.estabelecimento);
    console.log('Itens:', data.itens);

    await browser.close();
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao processar imagem do WhatsApp' });
  }
}
