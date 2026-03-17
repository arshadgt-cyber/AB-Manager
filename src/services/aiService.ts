import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateMarketingContent = async (title: string, platform: string, language: string, type: string) => {
  const ai = getAI();
  const prompt = `
    Generate a professional and engaging marketing message for a business in the UAE.
    Campaign Title: ${title}
    Platform: ${platform}
    Language: ${language}
    Campaign Type: ${type}
    
    The message should be culturally appropriate for the UAE, use AED for currency if mentioned, and include relevant emojis.
    Keep it concise and suitable for the chosen platform.
    Return only the message content.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are an expert marketing consultant for UAE businesses. You specialize in creating high-converting content for WhatsApp, Instagram, and Facebook.",
    },
    contents: prompt,
  });

  return response.text || "";
};

export const generateSocialProofAd = async (productName: string, customerName: string) => {
  const ai = getAI();
  const prompt = `
    Generate a 1-sentence catchy social proof advertisement for a business named "AL BERAKAH".
    Product Sold: ${productName}
    Customer: ${customerName}
    
    The ad should sound professional, friendly, and build trust. 
    Include both English and Malayalam versions.
    Example: "Another high-performance Pedrollo pump delivered today! Reliability you can trust at AL BERAKAH."
    
    Return only the ad text.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a creative advertising expert for UAE-based trading businesses.",
    },
    contents: prompt,
  });

  return response.text || "";
};

export const generateProductDescription = async (name: string, category: string) => {
  const ai = getAI();
  const prompt = `
    Generate a professional and concise product description for an inventory item.
    Product Name: ${name}
    Category: ${category}
    
    The description should be suitable for a business inventory system, highlighting key features if possible.
    Keep it under 100 words.
    Return only the description text.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a professional inventory manager and copywriter.",
    },
    contents: prompt,
  });

  return response.text || "";
};

export const analyzeFinancialData = async (data: any) => {
  const ai = getAI();
  const prompt = `
    Analyze the following financial data for a UAE-based SME and provide 3 actionable business insights.
    Data: ${JSON.stringify(data)}
    
    Focus on cash flow, expense management, and revenue growth.
    Return the insights as a bulleted list.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are a senior financial advisor for UAE SMEs.",
    },
    contents: prompt,
  });

  return response.text || "";
};
