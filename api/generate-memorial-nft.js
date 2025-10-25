import axios from "axios";
import FormData from "form-data";
import sharp from "sharp";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb",
    },
  },
};

const PINATA_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
  console.warn("PINATA keys not set — set PINATA_API_KEY and PINATA_SECRET_API_KEY in Vercel env vars");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST" });

  try {
    const { fname, tokenId, engagers } = req.body;
    if (!fname || typeof tokenId === "undefined" || !Array.isArray(engagers) || engagers.length < 1) {
      return res.status(400).json({ error: "Missing params: fname, tokenId, engagers[]" });
    }

    // Limit to 5 images (or less)
    const top = engagers.slice(0, 5);

    // 1) Download images (or placeholder)
    const images = await Promise.all(top.map(async (u) => {
      try {
        const resp = await axios.get(u.pfp, { responseType: "arraybuffer", timeout: 10000 });
        return { buffer: Buffer.from(resp.data), fname: u.fname };
      } catch (e) {
        // placeholder 200x200 gray
        const placeholder = await sharp({
          create: { width: 200, height: 200, channels: 3, background: "#bdbdbd" }
        }).png().toBuffer();
        return { buffer: placeholder, fname: u.fname };
      }
    }));

    // 2) Compose image: canvas 800x500
    const outputWidth = 800;
    const outputHeight = 500;
    const pfpSize = 200;
    const padding = 20;
    const composites = images.map((img, index) => {
      const topOffset = index < 3 ? 40 : 300;
      const col = index % 3;
      const leftOffset = index < 3
        ? Math.round((outputWidth - 3 * pfpSize - 2 * padding) / 2 + (pfpSize + padding) * col)
        : Math.round((outputWidth - 2 * pfpSize - padding) / 2 + (pfpSize + padding) * col);
      return { input: img.buffer, top: topOffset, left: leftOffset };
    });

    const finalBuffer = await sharp({
      create: { width: outputWidth, height: outputHeight, channels: 3, background: "#f0f4f8" }
    }).composite(composites).png().toBuffer();

    // 3) Pin image to Pinata (multipart/form-data)
    const imageForm = new FormData();
    imageForm.append("file", finalBuffer, { filename: `${fname}_${tokenId}.png` });

    // Optionally add metadata for Pinata
    imageForm.append("pinataMetadata", JSON.stringify({ name: `${fname}_${tokenId}.png` }));

    const imageUploadResp = await axios.post(PINATA_FILE_URL, imageForm, {
      headers: {
        ...imageForm.getHeaders(),
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY,
      },
      maxBodyLength: Infinity,
    }).catch(e => {
      console.error("Pinata image upload error:", e?.response?.data || e.message);
      throw new Error("Image pin failed");
    });

    const imageCID = imageUploadResp.data.IpfsHash;
    const imageURI = `ipfs://${imageCID}`;

    // 4) Create metadata JSON
    const metadata = {
      name: `Memorial NFT - @${fname} - #${tokenId}`,
      description: `Top engagers for @${fname}`,
      image: imageURI,
      attributes: top.map((u, idx) => ({ trait_type: `Engager ${idx+1}`, value: u.fname }))
    };

    // 5) Pin metadata JSON
    const jsonResp = await axios.post(PINATA_JSON_URL, metadata, {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_API_KEY,
        "Content-Type": "application/json"
      }
    }).catch(e => {
      console.error("Pinata json upload error:", e?.response?.data || e.message);
      throw new Error("Metadata pin failed");
    });

    const metadataCID = jsonResp.data.IpfsHash;
    const metadataURI = `ipfs://${metadataCID}`;

    // 6) Return results
    return res.status(200).json({
      success: true,
      imageCID,
      metadataCID,
      imageURI,
      metadataURI,
      gatewayImage: `https://gateway.pinata.cloud/ipfs/${imageCID}`,
      gatewayMetadata: `https://gateway.pinata.cloud/ipfs/${metadataCID}`
    });

  } catch (err) {
    console.error("handler error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
