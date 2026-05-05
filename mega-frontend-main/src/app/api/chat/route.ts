import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  // Client is safely initialized inside the POST function
  const openai = new OpenAI({ apiKey });

  try {
    const { messages } = await req.json();

    const vectorStoreFiles = await openai.vectorStores.files.list(
      "vs_680d44bc296081918edb4523aa34a0ce"
    );

    // FIXED: Corrected method to chat.completions.create
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // FIXED: Changed from gpt-4.1 to gpt-4o (the latest model)
      
      // Note: The 'file_search' tool was removed here because it only works 
      // in the Assistants API, not in standard Chat Completions.
      
      messages: [ // FIXED: Changed 'input' to 'messages'
        {
          role: "system",
          content:
            "You are an intelligent insurance assistant designed to help citizens manage and understand their various insurance policies—such as medical, automotive, life, education, and family insurance—especially when they are purchased from different providers. Your goal is to address a key citizen pain point: people like Ali are overwhelmed by managing many policies across insurers. They often forget claim procedures, misunderstand policy terms, and end up with duplicate benefits or overlapping coverage. Your role is to analyze their uploaded insurance documents, summarize key terms, identify duplicates or overlapping policies, and provide actionable insights to help them optimize their insurance coverage. You must communicate clearly, avoid jargon, and focus on empowering citizens to make informed insurance decisions. Emphasize the positive impacts: reduced confusion, better financial planning, and peace of mind. Do not reply to anything that is irrelevant!",
        },
        {
          role: "user",
          content:
            `Currently there are ${
              vectorStoreFiles.data.length
            } files in the vector store. Here are the file ids: ${vectorStoreFiles.data
              .map((file) => file.id)
              .join(", ")}. NEVER show the file id in the response!\n\n` +
            messages[messages.length - 1].content,
        },
      ],
    });

    // Log the response to see its structure
    console.log("OpenAI Response:", response);

    return NextResponse.json({
      message: {
        role: "assistant",
        // FIXED: Corrected the path to get the actual text response
        content: response.choices[0].message.content || "", 
      },
      // FIXED: Corrected to the proper standard ID property
      id: response.id, 
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}