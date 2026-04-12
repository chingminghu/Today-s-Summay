import { NextResponse } from "next/server";
import { getLatestDigest } from "@/lib/digest";

export async function GET() {
  try {
    const digest = await getLatestDigest();

    if (!digest) {
      return NextResponse.json(
        {
          success: false,
          message: "No digest found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      digest: {
        ...digest,
        rawNewsJson: JSON.parse(digest.rawNewsJson),
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}