const UserModel = require('../models/User');
const { decryptData } = require('../utils/decryption');
const axios = require('axios');

const PINATA_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

// Helper function to fetch data from IPFS
async function returnIpfsResponse(ipfsHash) {
  try {
    const res = await axios.get(`${PINATA_GATEWAY_URL}${ipfsHash}`);
    return res.data;
  } catch (error) {
    console.error(`Failed to fetch IPFS data for hash ${ipfsHash}:`, error.message);
    throw new Error("Failed to fetch IPFS data");
  }
}

async function getImageController(req, res) {
  try {
    // Ensure address extraction is correct
    const address = req.user?.address || req.body.address;
    if (!address) {
      return res.status(400).json({ message: "User address is required" });
    }

    const userAddress = address.toLowerCase();
    const user = await UserModel.findOne({ userAddress });

    if (!user) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const { page = 1, limit = 2 } = req.query;
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber < 1 || limitNumber < 1) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // Ensure request body contains IPFS hash array
    const ipfsHashArray = req.body?.hashes || [];
    if (!Array.isArray(ipfsHashArray) || ipfsHashArray.length === 0) {
      return res.status(400).json({ message: "No IPFS hashes provided" });
    }

    const startIndex = (pageNumber - 1) * limitNumber;
    const paginatedHashes = ipfsHashArray.slice(startIndex, startIndex + limitNumber);
    const decryptedImageArr = [];

    // Fetch encrypted data from IPFS and decrypt it
    const encryptedDataArr = await Promise.all(
      paginatedHashes.map(async (ipfsHash) => {
        try {
          const data = await returnIpfsResponse(ipfsHash);
          return data;
        } catch (error) {
          console.warn(`Skipping hash ${ipfsHash} due to error.`);
          return null; // Handle failed fetch gracefully
        }
      })
    );

    // Decrypt each image data
    for (const img of encryptedDataArr) {
      if (img) {
        const decryptedImgData = decryptData(
          img.encryptedData,
          img.iv,
          user.encryptionKey
        );
        decryptedImageArr.push(decryptedImgData.toString('base64'));
      }
    }

    console.log(decryptedImageArr);
    res.status(200).json({ message: "Images sent", decryptedImageArr });
  } catch (error) {
    console.error("Error in getImageController:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { getImageController };
