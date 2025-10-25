// api/generate-memorial-nft.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fname } = req.body;
    if (!fname) {
      return res.status(400).json({ error: "fname alanı zorunlu" });
    }

    // Simülasyon verisi (gerçek Farcaster API ile değiştirebilirsin)
    const mockEngagers = {
      'dwr': [
        { fname: 'v', fid: 2, engagement_score: 980, casts: 120, followers: '15.2k' },
        { fname: 'ccarella', fid: 3, engagement_score: 750, casts: 80, followers: '10.5k' },
        { fname: 'pedro', fid: 4, engagement_score: 520, casts: 200, followers: '2.1k' },
      ],
      'nodepro': [
        { fname: 'synth_dev', fid: 501, engagement_score: 1100, casts: 300, followers: '50k' },
        { fname: 'web3_wizard', fid: 502, engagement_score: 950, casts: 150, followers: '22k' },
      ],
      'simulasyoncu': [
        { fname: 'mehmet', fid: 101, engagement_score: 650, casts: 50, followers: '300' },
        { fname: 'ayse', fid: 102, engagement_score: 500, casts: 90, followers: '450' },
      ]
    };

    const result = mockEngagers[fname.toLowerCase()] || mockEngagers['simulasyoncu'];

    // 1 saniye gecikme simülasyonu
    await new Promise(resolve => setTimeout(resolve, 1000));

    res.status(200).json({ success: true, engagers: result });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
}
