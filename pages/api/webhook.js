import Jimp from 'jimp';
import QrCode from 'qrcode-reader';
import puppeteer from 'puppeteer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Only POST allowed');
  }

  try {
    const { imageBase64 } = req.body;

    const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');
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

    const browser = await puppeteer.launch({ headless: true });
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
    res.status(500).json({ error: 'Erro ao processar QR code' });
  }
}
