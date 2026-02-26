require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ========================================
// Paket bazlı System Prompt + User Prompt
// ========================================
const PACKAGE_PROMPTS = {
  1: {
    name: 'Eski Sevgili Radarı',
    system: `Sen şüpheci, detaycı ve "yalan yakalayıcı" bir dedektifsin. Türkçe yaz.
Nostaljiye, kıyaslamaya ve gizli özlem belirtilerine odaklan.
Dili sert, net ve yargılayıcı tut. Emoji kullan ama abartma.
Yanıtını düz metin olarak ver, markdown kullanma.`,
    prompt: (data) => `Kullanıcının partneri hakkında veriler:
- Burcu: ${data.zodiac}
- Arketip: ${data.archetype}
- Red Flag Skoru: %${data.score}
- Tartışma Tepkisi: ${data.q1}
- Instagram Keşfet: ${data.q2}
- Hitap Şekli: ${data.q3}
- Hesap Ödeme Tavrı: ${data.q5}
- Kriz Anı Davranışı: ${data.q6}
- WhatsApp Mesajları: "${data.messages || 'Mesaj verilmedi'}"

Sen bir 'Eski Sevgili Radarı'sın. Sana verilen mesajlardaki kelime seçimlerini (örn: 'eskiden böyle yapmazdın', 'o da severdi') ve partnerin genel soğukluğunu analiz et. Bu kişinin aklının % kaçının hala eski sevgilisinde olduğunu ve mevcut ilişkiyi sadece bir 'yara bandı' olarak kullanıp kullanmadığını tek bir acımasız paragrafla açıkla.`
  },
  2: {
    name: 'Freudyen Bilinçaltı Analizi',
    system: `Sen soğuk, entelektüel, Freudyen terimlere hakim ve analizlerinde hiç acıması olmayan bir psikanalistsin. Türkçe yaz.
Bağlanma stilleri, otorite figürleri ve çocukluk travmalarının mevcut ilişkiye yansımasına odaklan.
Z kuşağı jargonuna uygun ama bilimsel ağırlıkta yaz. Emoji kullan ama abartma.
Yanıtını düz metin olarak ver, markdown kullanma.`,
    prompt: (data) => `Kullanıcının partneri hakkında veriler:
- Burcu: ${data.zodiac}
- Arketip: ${data.archetype}
- Red Flag Skoru: %${data.score}
- Tartışma Tepkisi: ${data.q1}
- Instagram Keşfet: ${data.q2}
- Hitap Şekli: ${data.q3}
- Hesap Ödeme Tavrı: ${data.q5}
- Kriz Anı Davranışı: ${data.q6}
- WhatsApp Mesajları: "${data.messages || 'Mesaj verilmedi'}"

Sen bir Freudyen psikanalistisin. Kullanıcının formdaki cevaplarını (burç, element, alışkanlıklar) ve WhatsApp mesajlarını sentezle. Bu kişinin partnerinin aslında annesine/babasına olan öfkesini mi yansıttığını, narsistik bir yaralanma mı yaşadığını veya 'kaçıngan bağlanma' tuzağında mı olduğunu açıkla. Analizin Z kuşağı jargonuna uygun ama bilimsel bir ağırlıkta olsun.`
  },
  3: {
    name: 'Kıyamet Senaryosu',
    system: `Sen "gelecekten gelen" alaycı bir kahinsin. Türkçe yaz.
İlişkinin finali, ayrılık sonrası stalk süreci ve kimin daha çok acı çekeceğine odaklan.
Dramatik, hiper-gerçekçi ve kaçınılmaz bir son gibi kurgula. Emoji kullan ama abartma.
Yanıtını düz metin olarak ver, markdown kullanma.`,
    prompt: (data) => `Kullanıcının partneri hakkında veriler:
- Burcu: ${data.zodiac}
- Arketip: ${data.archetype}
- Red Flag Skoru: %${data.score}
- Tartışma Tepkisi: ${data.q1}
- Instagram Keşfet: ${data.q2}
- Hitap Şekli: ${data.q3}
- Hesap Ödeme Tavrı: ${data.q5}
- Kriz Anı Davranışı: ${data.q6}
- WhatsApp Mesajları: "${data.messages || 'Mesaj verilmedi'}"

Sen bir ilişki kahinisin. Mevcut tüm verileri al ve bu ilişkinin 'son perdesini' yaz. Ayrılık tam olarak hangi cümleyle başlayacak? Kim kimi engelleyecek? Ayrılıktan 3 ay sonra kim daha çok pişman olup 'Yazsam mı?' diye düşünecek? Bu süreci dramatik, hiper-gerçekçi ve kaçınılmaz bir son gibi kurgula.`
  },
};

// ========================================
// POST /api/claude — Backend proxy
// ========================================
app.post('/api/claude', async (req, res) => {
  try {
    const { packageId, data } = req.body;

    if (!packageId || !data) {
      return res.status(400).json({ error: 'Eksik veri: packageId ve data gerekli.' });
    }

    const pkg = PACKAGE_PROMPTS[packageId];
    if (!pkg) {
      return res.status(400).json({ error: 'Geçersiz paket ID.' });
    }

    console.log(`\n🔮 Claude API çağrısı — Paket: ${pkg.name}`);
    console.log(`   Arketip: ${data.archetype} | Skor: %${data.score} | Burç: ${data.zodiac}`);

    // Kıyamet Senaryosu (paket 3) daha uzun ve dramatik analiz için yüksek token
    const maxTokens = packageId === 3 ? 1024 : 500;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature: 0.8,
      system: pkg.system,
      messages: [
        {
          role: 'user',
          content: pkg.prompt(data),
        },
      ],
    });

    const responseText = message.content[0].text;
    console.log(`   ✅ Yanıt alındı (${responseText.length} karakter)\n`);

    res.json({
      success: true,
      packageName: pkg.name,
      analysis: responseText,
    });

  } catch (error) {
    console.error('❌ Claude API hatası:', error.message);
    res.status(500).json({
      error: 'AI analiz sırasında bir hata oluştu.',
      details: error.message,
    });
  }
});

// ========================================
// Serve index.html for root
// ========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// Start server
// ========================================
app.listen(PORT, () => {
  console.log(`\n🚩 Redflag.ai sunucusu çalışıyor: http://localhost:${PORT}`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? '✅ Yüklendi' : '❌ BULUNAMADI!'}\n`);
});
